import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { Priority, RepairStatus } from "@sagman/db";
import {
  CreateAppointmentSchema,
  ConfirmAppointmentSchema,
  RescheduleAppointmentSchema,
  CancelAppointmentSchema,
} from "@sagman/shared";
import { authorize } from "../../../hooks/authorize";
import { Errors } from "../../../utils/errors";
import { getPaginationParams, paginate } from "../../../utils/pagination";
import { JwtPayload } from "../../../plugins/jwt";

const ACTIVE_REPAIR_STATUSES: RepairStatus[] = [
  RepairStatus.received,
  RepairStatus.diagnosing,
  RepairStatus.awaiting_approval,
  RepairStatus.in_progress,
  RepairStatus.waiting_for_parts,
  RepairStatus.complete,
];

export async function appointmentRoutes(fastify: FastifyInstance) {
  // All appointment routes require manager role
  fastify.addHook("preHandler", authorize(["manager"]));

  // GET /api/v1/appointments — List appointments (paginated, filterable)
  fastify.get("/", async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as {
      status?: string;
      date?: string;
      page?: string;
      limit?: string;
    };

    const { page, limit, skip } = getPaginationParams({
      page: query.page ? parseInt(query.page) : 1,
      limit: query.limit ? parseInt(query.limit) : 20,
    });

    const where: Record<string, unknown> = { deletedAt: null };

    if (query.status) {
      where.status = query.status;
    }

    if (query.date) {
      const d = new Date(query.date);
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
      where.requestedAt = { gte: dayStart, lt: dayEnd };
    }

    const [appointments, total] = await fastify.prisma.$transaction([
      fastify.prisma.appointment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { requestedAt: "desc" },
        include: {
          client: {
            select: { id: true, name: true, phone: true },
          },
          car: {
            select: { id: true, matricule: true, make: true, model: true },
          },
        },
      }),
      fastify.prisma.appointment.count({ where }),
    ]);

    return reply.send(paginate(appointments, total, page, limit));
  });

  // POST /api/v1/appointments — Create appointment (manager-initiated, confirmed immediately)
  fastify.post("/", async (request: FastifyRequest, reply: FastifyReply) => {
    const body = CreateAppointmentSchema.parse(request.body);

    const currentUser = (request as any).user as JwtPayload;

    const appointment = await fastify.prisma.appointment.create({
      data: {
        ...body,
        createdById: currentUser.sub,
        status: "confirmed",
        confirmedAt: new Date(),
      },
    });

    return reply.status(201).send({ data: appointment });
  });

  // GET /api/v1/appointments/:id — Appointment detail
  fastify.get("/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const appointment = await fastify.prisma.appointment.findFirst({
      where: { id, deletedAt: null },
      include: {
        client: true,
        car: true,
        createdBy: {
          select: { name: true },
        },
        repairJob: {
          select: { id: true, status: true },
        },
      },
    });

    if (!appointment) throw Errors.NotFound("Appointment", id);

    return reply.send({ data: appointment });
  });

  // PATCH /api/v1/appointments/:id — Edit appointment (only if pending or confirmed)
  fastify.patch(
    "/:id",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };

      const appointment = await fastify.prisma.appointment.findFirst({
        where: { id, deletedAt: null },
      });
      if (!appointment) throw Errors.NotFound("Appointment", id);

      if (
        appointment.status === "converted" ||
        appointment.status === "cancelled"
      ) {
        throw Errors.BadRequest(
          `Cannot edit an appointment with status '${appointment.status}'`,
          "INVALID_STATUS_TRANSITION",
        );
      }

      const body = request.body as {
        purpose?: string;
        notes?: string;
        requestedAt?: string;
      };

      const updated = await fastify.prisma.appointment.update({
        where: { id },
        data: {
          ...(body.purpose !== undefined && { purpose: body.purpose }),
          ...(body.notes !== undefined && { notes: body.notes }),
          ...(body.requestedAt !== undefined && {
            requestedAt: new Date(body.requestedAt),
          }),
        },
      });

      return reply.send({ data: updated });
    },
  );

  // PATCH /api/v1/appointments/:id/confirm — Confirm a pending appointment (BR-012)
  fastify.patch(
    "/:id/confirm",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const query = request.query as { force?: string };
      const force = query.force === "true";

      const appointment = await fastify.prisma.appointment.findFirst({
        where: { id, deletedAt: null },
      });
      if (!appointment) throw Errors.NotFound("Appointment", id);

      if (appointment.status !== "pending") {
        throw Errors.BadRequest(
          `Only pending appointments can be confirmed. Current status: '${appointment.status}'`,
          "INVALID_STATUS_TRANSITION",
        );
      }

      // BR-012: Capacity check — count confirmed/rescheduled appointments on the same day
      if (!force) {
        const date = new Date(appointment.requestedAt);
        const dayStart = new Date(
          date.getFullYear(),
          date.getMonth(),
          date.getDate(),
        );
        const dayEnd = new Date(
          date.getFullYear(),
          date.getMonth(),
          date.getDate() + 1,
        );

        const count = await fastify.prisma.appointment.count({
          where: {
            status: { in: ["confirmed", "rescheduled"] },
            requestedAt: { gte: dayStart, lt: dayEnd },
            deletedAt: null,
            id: { not: id },
          },
        });

        const settingRow = await fastify.prisma.systemSettings.findUnique({
          where: { key: "max_concurrent_cars" },
        });
        const capacityLimit = settingRow ? parseInt(settingRow.value) : 5;

        if (count >= capacityLimit) {
          return reply.status(200).send({
            data: {
              warning: "Capacity limit reached",
              capacityLimit,
              currentCount: count,
            },
            requiresAcknowledgement: true,
          });
        }
      }

      const updated = await fastify.prisma.appointment.update({
        where: { id },
        data: { status: "confirmed", confirmedAt: new Date() },
      });

      return reply.send({ data: updated });
    },
  );

  // PATCH /api/v1/appointments/:id/reschedule — Reschedule appointment
  fastify.patch(
    "/:id/reschedule",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const body = RescheduleAppointmentSchema.parse(request.body);

      const appointment = await fastify.prisma.appointment.findFirst({
        where: { id, deletedAt: null },
      });
      if (!appointment) throw Errors.NotFound("Appointment", id);

      if (
        appointment.status !== "pending" &&
        appointment.status !== "confirmed"
      ) {
        throw Errors.BadRequest(
          `Only pending or confirmed appointments can be rescheduled. Current status: '${appointment.status}'`,
          "INVALID_STATUS_TRANSITION",
        );
      }

      const updated = await fastify.prisma.appointment.update({
        where: { id },
        data: {
          status: "rescheduled",
          rescheduledTo: new Date(body.rescheduledTo),
          ...(body.notes !== undefined && { notes: body.notes }),
        },
      });

      return reply.send({ data: updated });
    },
  );

  // PATCH /api/v1/appointments/:id/cancel — Cancel appointment
  fastify.patch(
    "/:id/cancel",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const body = CancelAppointmentSchema.parse(request.body);

      const appointment = await fastify.prisma.appointment.findFirst({
        where: { id, deletedAt: null },
      });
      if (!appointment) throw Errors.NotFound("Appointment", id);

      if (
        appointment.status === "converted" ||
        appointment.status === "cancelled"
      ) {
        throw Errors.BadRequest(
          `Cannot cancel an appointment with status '${appointment.status}'`,
          "INVALID_STATUS_TRANSITION",
        );
      }

      const updated = await fastify.prisma.appointment.update({
        where: { id },
        data: {
          status: "cancelled",
          cancellationReason: body.cancellationReason,
        },
      });

      return reply.send({ data: updated });
    },
  );

  // POST /api/v1/appointments/:id/convert — Convert confirmed appointment to a RepairJob
  fastify.post(
    "/:id/convert",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const convertingUser = (request as any).user as JwtPayload;
      const body = request.body as {
        primaryMechanicId: string;
        priority?: string;
        description?: string;
        targetCompletionDate?: string;
      };

      const appointment = await fastify.prisma.appointment.findFirst({
        where: { id, deletedAt: null },
      });
      if (!appointment) throw Errors.NotFound("Appointment", id);

      if (appointment.status !== "confirmed") {
        throw Errors.BadRequest(
          `Only confirmed appointments can be converted to a repair. Current status: '${appointment.status}'`,
          "INVALID_STATUS_TRANSITION",
        );
      }

      // Validate mechanic exists and is active
      const mechanic = await fastify.prisma.user.findUnique({
        where: { id: body.primaryMechanicId },
      });
      if (!mechanic || mechanic.status !== "active") {
        throw Errors.BadRequest(
          "The assigned mechanic does not exist or is not active",
          "INVALID_MECHANIC",
        );
      }

      // Resolve carId — may be null if appointment only has a matricule
      let carId = appointment.carId;
      if (!carId && appointment.carMatricule) {
        const car = await fastify.prisma.car.findFirst({
          where: { matricule: appointment.carMatricule, deletedAt: null },
        });
        if (car) carId = car.id;
      }

      if (!carId) {
        throw Errors.BadRequest(
          "Cannot convert appointment: no car is linked and the matricule could not be resolved to an existing car.",
          "CAR_NOT_RESOLVED",
        );
      }

      // BR-008: Check car has no active repair
      if (carId) {
        const activeRepair = await fastify.prisma.repairJob.findFirst({
          where: {
            carId,
            status: { in: ACTIVE_REPAIR_STATUSES },
          },
        });
        if (activeRepair) {
          throw Errors.BusinessRule(
            "CAR_HAS_ACTIVE_REPAIR",
            "This car already has an active repair in progress. Close or cancel it before creating a new one.",
          );
        }
      }

      // Create the RepairJob, RepairMechanic record, initial status log, and update appointment atomically
      const [repair] = await fastify.prisma.$transaction(async (tx) => {
        const newRepair = await tx.repairJob.create({
          data: {
            carId: carId,
            appointmentId: appointment.id,
            createdById: convertingUser.sub,
            primaryMechanicId: body.primaryMechanicId,
            status: RepairStatus.received,
            priority: (body.priority as Priority) ?? Priority.normal,
            description: body.description ?? appointment.purpose,
            targetCompletionDate: body.targetCompletionDate
              ? new Date(body.targetCompletionDate)
              : null,
          },
        });

        await tx.repairMechanic.create({
          data: {
            repairId: newRepair.id,
            mechanicId: body.primaryMechanicId,
            isPrimary: true,
          },
        });

        await tx.repairStatusLog.create({
          data: {
            repairId: newRepair.id,
            fromStatus: null,
            toStatus: "received",
            changedById: convertingUser.sub,
          },
        });

        await tx.appointment.update({
          where: { id },
          data: { status: "converted" },
        });

        return [newRepair];
      });

      return reply.status(201).send({
        data: {
          repairId: repair.id,
          appointmentId: appointment.id,
        },
      });
    },
  );

  // DELETE /api/v1/appointments/:id — Soft delete
  fastify.delete(
    "/:id",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };

      const appointment = await fastify.prisma.appointment.findFirst({
        where: { id, deletedAt: null },
      });
      if (!appointment) throw Errors.NotFound("Appointment", id);

      if (appointment.status === "converted") {
        throw Errors.BusinessRule(
          "APPOINTMENT_CONVERTED",
          "Cannot delete a converted appointment. It is linked to an active repair job.",
        );
      }

      await fastify.prisma.appointment.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      return reply.send({ data: { message: "Appointment deleted" } });
    },
  );
}
