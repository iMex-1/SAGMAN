import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { RepairStatus } from "@sagman/db";
import { CreateCarSchema, UpdateCarSchema } from "@sagman/shared";
import { authorize } from "../../../hooks/authorize";
import { Errors } from "../../../utils/errors";
import { getPaginationParams, paginate } from "../../../utils/pagination";

const ACTIVE_REPAIR_STATUSES: RepairStatus[] = [
  RepairStatus.received,
  RepairStatus.diagnosing,
  RepairStatus.awaiting_approval,
  RepairStatus.in_progress,
  RepairStatus.waiting_for_parts,
  RepairStatus.complete,
];

export async function carRoutes(fastify: FastifyInstance) {
  // All car routes require manager role
  fastify.addHook("preHandler", authorize(["manager"]));

  // GET /api/v1/cars — List cars (paginated, searchable)
  fastify.get("/", async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as {
      q?: string;
      page?: string;
      limit?: string;
    };

    const { page, limit, skip } = getPaginationParams({
      page: query.page ? parseInt(query.page) : 1,
      limit: query.limit ? parseInt(query.limit) : 20,
    });

    const where: Record<string, unknown> = { deletedAt: null };

    if (query.q) {
      where.OR = [
        { matricule: { contains: query.q, mode: "insensitive" } },
        { make: { contains: query.q, mode: "insensitive" } },
        { model: { contains: query.q, mode: "insensitive" } },
      ];
    }

    const [cars, total] = await fastify.prisma.$transaction([
      fastify.prisma.car.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          client: {
            select: { id: true, name: true },
          },
          _count: {
            select: { repairs: true },
          },
        },
      }),
      fastify.prisma.car.count({ where }),
    ]);

    return reply.send(paginate(cars, total, page, limit));
  });

  // POST /api/v1/cars — Register a new car
  fastify.post("/", async (request: FastifyRequest, reply: FastifyReply) => {
    const body = CreateCarSchema.parse(request.body);

    const matriculeUpper = body.matricule.toUpperCase();

    const existing = await fastify.prisma.car.findFirst({
      where: { matricule: { equals: matriculeUpper, mode: "insensitive" } },
    });
    if (existing) {
      throw Errors.Conflict(
        `A car with matricule '${matriculeUpper}' already exists`,
      );
    }

    const car = await fastify.prisma.car.create({
      data: {
        ...body,
        matricule: matriculeUpper,
      },
    });

    return reply.status(201).send({ data: car });
  });

  // GET /api/v1/cars/:id — Car detail with recent repairs
  fastify.get("/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const car = await fastify.prisma.car.findFirst({
      where: { id, deletedAt: null },
      include: {
        client: {
          select: { id: true, name: true, phone: true },
        },
        repairs: {
          orderBy: { createdAt: "desc" },
          take: 10,
          include: {
            primaryMechanic: {
              select: { name: true },
            },
          },
        },
      },
    });

    if (!car) throw Errors.NotFound("Car", id);

    return reply.send({ data: car });
  });

  // PATCH /api/v1/cars/:id — Update car details
  fastify.patch(
    "/:id",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const body = UpdateCarSchema.parse(request.body);

      const existing = await fastify.prisma.car.findFirst({
        where: { id, deletedAt: null },
      });
      if (!existing) throw Errors.NotFound("Car", id);

      // Matricule cannot be changed after creation
      const bodyAny = body as typeof body & { matricule?: string };
      if (
        bodyAny.matricule &&
        bodyAny.matricule.toUpperCase() !== existing.matricule
      ) {
        throw Errors.BadRequest(
          "Matricule cannot be changed after creation",
          "IMMUTABLE_FIELD",
        );
      }

      // Strip matricule from update payload regardless
      const { matricule: _matricule, ...updateData } = bodyAny;

      const updated = await fastify.prisma.car.update({
        where: { id },
        data: updateData,
      });

      return reply.send({ data: updated });
    },
  );

  // DELETE /api/v1/cars/:id — Soft delete
  fastify.delete(
    "/:id",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };

      const car = await fastify.prisma.car.findFirst({
        where: { id, deletedAt: null },
      });
      if (!car) throw Errors.NotFound("Car", id);

      // Block if car has active repairs
      const activeRepairsCount = await fastify.prisma.repairJob.count({
        where: {
          carId: id,
          status: { in: ACTIVE_REPAIR_STATUSES },
        },
      });
      if (activeRepairsCount > 0) {
        throw Errors.BusinessRule(
          "CAR_HAS_ACTIVE_REPAIRS",
          `Cannot delete car with ${activeRepairsCount} active repair(s). Close or cancel them first.`,
        );
      }

      await fastify.prisma.car.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      return reply.send({ data: { message: "Car deleted" } });
    },
  );

  // GET /api/v1/cars/:id/repairs — Car repair history (paginated)
  fastify.get(
    "/:id/repairs",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const query = request.query as { page?: string; limit?: string };

      const car = await fastify.prisma.car.findFirst({
        where: { id, deletedAt: null },
      });
      if (!car) throw Errors.NotFound("Car", id);

      const { page, limit, skip } = getPaginationParams({
        page: query.page ? parseInt(query.page) : 1,
        limit: query.limit ? parseInt(query.limit) : 20,
      });

      const where = { carId: id };

      const [repairs, total] = await fastify.prisma.$transaction([
        fastify.prisma.repairJob.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            status: true,
            priority: true,
            primaryMechanic: {
              select: { name: true },
            },
            createdAt: true,
            actualCompletionDate: true,
          },
        }),
        fastify.prisma.repairJob.count({ where }),
      ]);

      return reply.send(paginate(repairs, total, page, limit));
    },
  );
}
