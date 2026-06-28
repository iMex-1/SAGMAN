import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import {
  CreateRepairSchema,
  UpdateRepairStatusSchema,
  DiagnosisReportSchema,
  ClientApprovalSchema,
  AddWorkLogSchema,
  DelayReportSchema,
  AssignPartSchema,
  AddLaborItemSchema,
} from '@sagman/shared'
import { authorize } from '../../../hooks/authorize'
import { Errors } from '../../../utils/errors'
import { getPaginationParams, paginate } from '../../../utils/pagination'
import {
  TERMINAL_STATUSES,
  ACTIVE_STATUSES,
  isTransitionAllowed,
  isOverdue,
  computeTotals,
} from '../../../services/repair.service'
import { JwtPayload } from '../../../plugins/jwt'

// ─── Helper ───────────────────────────────────────────────────────────────────

async function recalculateRepairTotals(fastify: FastifyInstance, repairId: string) {
  const [parts, labor, repair] = await fastify.prisma.$transaction([
    fastify.prisma.repairPart.findMany({ where: { repairId } }),
    fastify.prisma.laborItem.findMany({ where: { repairId } }),
    fastify.prisma.repairJob.findUnique({
      where: { id: repairId },
      select: { discountAmount: true },
    }),
  ])
  if (!repair) return
  const { partsTotal, laborTotal, finalTotal } = computeTotals(
    parts,
    labor,
    repair.discountAmount ?? 0,
  )
  await fastify.prisma.repairJob.update({
    where: { id: repairId },
    data: {
      partsTotal,
      laborTotal,
      finalTotal,
      estimatedCost: finalTotal,
    },
  })
}

// ─── Routes ───────────────────────────────────────────────────────────────────

export async function repairRoutes(fastify: FastifyInstance) {
  // ── GET / — List repairs ────────────────────────────────────────────────────
  fastify.get(
    '/',
    { preHandler: authorize(['manager', 'mechanic']) },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as JwtPayload
      const query = request.query as {
        status?: string
        priority?: string
        mechanicId?: string
        isOverdue?: string
        page?: string
        limit?: string
      }

      const { page, limit, skip } = getPaginationParams({
        page: query.page ? parseInt(query.page) : 1,
        limit: query.limit ? parseInt(query.limit) : 20,
      })

      // Mechanic filter: mechanics can only see repairs they're assigned to
      const mechanicId = query.mechanicId
      const mechanicFilter =
        user.role === 'mechanic'
          ? { mechanics: { some: { mechanicId: user.sub } } }
          : mechanicId
            ? { mechanics: { some: { mechanicId } } }
            : {}

      // Status filter (comma-separated)
      const statusFilter =
        query.status
          ? { status: { in: query.status.split(',').map((s) => s.trim()) as any[] } }
          : {}

      // Priority filter
      const priorityFilter = query.priority ? { priority: query.priority as any } : {}

      // isOverdue filter: target date in the past, not in terminal/complete state
      const overdueFilter =
        query.isOverdue === 'true'
          ? {
              targetCompletionDate: { lt: new Date() },
              status: { notIn: ['complete', 'delivered', 'cancelled'] as any[] },
            }
          : {}

      const where = {
        ...mechanicFilter,
        ...statusFilter,
        ...priorityFilter,
        ...overdueFilter,
      }

      const [repairs, total] = await fastify.prisma.$transaction([
        fastify.prisma.repairJob.findMany({
          where,
          skip,
          take: limit,
          orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
          include: {
            car: {
              select: { id: true, matricule: true, make: true, model: true },
            },
            primaryMechanic: {
              select: { id: true, name: true },
            },
            _count: {
              select: { mechanics: true, delayReports: true },
            },
          },
        }),
        fastify.prisma.repairJob.count({ where }),
      ])

      const repairsWithOverdue = repairs.map((r) => ({ ...r, isOverdue: isOverdue(r) }))

      return reply.send(paginate(repairsWithOverdue, total, page, limit))
    },
  )

  // ── POST / — Create repair ──────────────────────────────────────────────────
  fastify.post(
    '/',
    { preHandler: authorize(['manager']) },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as JwtPayload
      const body = CreateRepairSchema.parse(request.body)

      // BR-008: car must have no active repair
      const activeRepair = await fastify.prisma.repairJob.findFirst({
        where: {
          carId: body.carId,
          status: { in: ACTIVE_STATUSES as any[] },
        },
      })
      if (activeRepair) {
        throw Errors.BusinessRule(
          'CAR_HAS_ACTIVE_REPAIR',
          'This car already has an active repair job',
        )
      }

      // Validate car exists and is not soft-deleted
      const car = await fastify.prisma.car.findFirst({
        where: { id: body.carId, deletedAt: null },
      })
      if (!car) throw Errors.NotFound('Car', body.carId)

      // Validate primary mechanic exists, is active, and has role mechanic
      const mechanic = await fastify.prisma.user.findUnique({
        where: { id: body.primaryMechanicId },
      })
      if (!mechanic || mechanic.status !== 'active' || mechanic.role !== 'mechanic') {
        throw Errors.BadRequest(
          'The assigned mechanic does not exist, is not active, or does not have the mechanic role',
          'INVALID_MECHANIC',
        )
      }

      // Create the repair job
      const repair = await fastify.prisma.repairJob.create({
        data: {
          carId: body.carId,
          appointmentId: body.appointmentId ?? null,
          createdById: user.sub,
          primaryMechanicId: body.primaryMechanicId,
          status: 'received',
          priority: body.priority ?? 'normal',
          description: body.description,
          internalNotes: body.internalNotes,
          estimatedDurationHours: body.estimatedDurationHours,
          targetCompletionDate: body.targetCompletionDate ? new Date(body.targetCompletionDate) : null,
        },
      })

      // Create primary RepairMechanic record
      await fastify.prisma.repairMechanic.create({
        data: { repairId: repair.id, mechanicId: body.primaryMechanicId, isPrimary: true },
      })

      // Create secondary RepairMechanic records
      if (body.secondaryMechanicIds && body.secondaryMechanicIds.length > 0) {
        await fastify.prisma.repairMechanic.createMany({
          data: body.secondaryMechanicIds.map((mid) => ({
            repairId: repair.id,
            mechanicId: mid,
            isPrimary: false,
          })),
          skipDuplicates: true,
        })
      }

      // Create initial status log
      await fastify.prisma.repairStatusLog.create({
        data: {
          repairId: repair.id,
          fromStatus: null,
          toStatus: 'received',
          changedById: user.sub,
        },
      })

      return reply.status(201).send({ data: repair })
    },
  )

  // ── GET /:id — Repair detail ────────────────────────────────────────────────
  fastify.get(
    '/:id',
    { preHandler: authorize(['manager', 'mechanic']) },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      const user = request.user as JwtPayload

      // Mechanic access check
      if (user.role === 'mechanic') {
        const assignment = await fastify.prisma.repairMechanic.findUnique({
          where: { repairId_mechanicId: { repairId: id, mechanicId: user.sub } },
        })
        if (!assignment) throw Errors.Forbidden('You are not assigned to this repair')
      }

      const repair = await fastify.prisma.repairJob.findUnique({
        where: { id },
        include: {
          car: {
            select: {
              id: true,
              matricule: true,
              make: true,
              model: true,
              year: true,
              color: true,
              client: { select: { id: true, name: true, phone: true } },
            },
          },
          appointment: { select: { id: true, status: true, purpose: true } },
          createdBy: { select: { id: true, name: true } },
          primaryMechanic: { select: { id: true, name: true, specialty: true } },
          mechanics: {
            include: { mechanic: { select: { id: true, name: true, specialty: true } } },
          },
          statusLogs: {
            orderBy: { createdAt: 'asc' },
            include: { changedBy: { select: { id: true, name: true } } },
          },
          workLogs: {
            orderBy: { loggedAt: 'desc' },
            include: { mechanic: { select: { id: true, name: true } } },
          },
          delayReports: {
            orderBy: { createdAt: 'desc' },
            include: { reportedBy: { select: { id: true, name: true } } },
          },
          parts: {
            include: {
              part: { select: { id: true, name: true, reference: true, category: true } },
            },
            orderBy: { addedAt: 'desc' },
          },
          laborItems: { orderBy: { addedAt: 'desc' } },
          payment: true,
          photos: {
            orderBy: { createdAt: 'desc' },
            include: { uploadedBy: { select: { id: true, name: true } } },
          },
        },
      })

      if (!repair) throw Errors.NotFound('Repair', id)

      return reply.send({
        data: {
          ...repair,
          isOverdue: isOverdue(repair),
          hasDelayReport: repair.delayReports.length > 0,
        },
      })
    },
  )

  // ── PATCH /:id — Update basic repair fields ─────────────────────────────────
  fastify.patch(
    '/:id',
    { preHandler: authorize(['manager']) },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      const body = request.body as {
        description?: string
        internalNotes?: string
        priority?: string
        targetCompletionDate?: string
        estimatedDurationHours?: number
        estimatedCost?: number
      }

      const repair = await fastify.prisma.repairJob.findUnique({ where: { id } })
      if (!repair) throw Errors.NotFound('Repair', id)

      const updated = await fastify.prisma.repairJob.update({
        where: { id },
        data: {
          ...(body.description !== undefined && { description: body.description }),
          ...(body.internalNotes !== undefined && { internalNotes: body.internalNotes }),
          ...(body.priority !== undefined && { priority: body.priority as any }),
          ...(body.targetCompletionDate !== undefined && {
            targetCompletionDate: body.targetCompletionDate ? new Date(body.targetCompletionDate) : null,
          }),
          ...(body.estimatedDurationHours !== undefined && {
            estimatedDurationHours: body.estimatedDurationHours,
          }),
          ...(body.estimatedCost !== undefined && { estimatedCost: body.estimatedCost }),
        },
      })

      return reply.send({ data: updated })
    },
  )

  // ── PATCH /:id/status — Status transition ───────────────────────────────────
  fastify.patch(
    '/:id/status',
    { preHandler: authorize(['manager', 'mechanic']) },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      const user = request.user as JwtPayload
      const body = UpdateRepairStatusSchema.parse(request.body)

      const repair = await fastify.prisma.repairJob.findUnique({
        where: { id },
        include: {
          mechanics: true,
          delayReports: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      })
      if (!repair) throw Errors.NotFound('Repair', id)

      // BR-002: Mechanic can only update assigned repairs
      if (user.role === 'mechanic') {
        const isAssigned = repair.mechanics.some((m) => m.mechanicId === user.sub)
        if (!isAssigned) throw Errors.Forbidden('You are not assigned to this repair')
      }

      // Terminal state check
      if (TERMINAL_STATUSES.includes(repair.status)) {
        throw Errors.BusinessRule(
          'TERMINAL_STATE',
          `Repair is in terminal state: ${repair.status}`,
        )
      }

      // Validate transition
      if (!isTransitionAllowed(repair.status, body.status)) {
        throw Errors.BusinessRule(
          'INVALID_TRANSITION',
          `Cannot transition from '${repair.status}' to '${body.status}'`,
        )
      }

      // Overdue check: require a delay report before any status update
      if (isOverdue(repair) && repair.delayReports.length === 0) {
        throw Errors.BusinessRule(
          'DELAY_REPORT_REQUIRED',
          'This repair is overdue. Please file a delay report before updating the status.',
        )
      }

      // Need at least one mechanic to start work
      if (body.status === 'in_progress' && repair.mechanics.length === 0) {
        throw Errors.BusinessRule('NO_MECHANIC', 'Assign a mechanic before starting the repair')
      }

      // BR-030: Complete → In Progress (rework) requires manager + reopenedReason
      if (repair.status === 'complete' && body.status === 'in_progress') {
        if (user.role !== 'manager') {
          throw Errors.Forbidden('Only a manager can reopen a completed repair')
        }
        if (!body.reopenedReason) {
          throw Errors.BusinessRule(
            'REOPEN_REASON_REQUIRED',
            'A reason is required to reopen a completed repair',
          )
        }
      }

      // Delivered requires payment
      if (body.status === 'delivered') {
        const payment = await fastify.prisma.payment.findUnique({ where: { repairId: id } })
        if (!payment) {
          throw Errors.BusinessRule(
            'PAYMENT_REQUIRED',
            'Register payment before marking as delivered',
          )
        }
      }

      // Cancellation requires reason
      if (body.status === 'cancelled' && !body.cancellationReason) {
        throw Errors.BusinessRule(
          'CANCELLATION_REASON_REQUIRED',
          'A reason is required to cancel a repair',
        )
      }

      // Build update data
      const updateData: any = { status: body.status }
      if (body.status === 'complete') updateData.actualCompletionDate = new Date()
      if (body.status === 'cancelled') updateData.cancellationReason = body.cancellationReason
      if (body.status === 'in_progress' && repair.status === 'complete') {
        updateData.reopenedReason = body.reopenedReason
      }

      const [updatedRepair] = await fastify.prisma.$transaction([
        fastify.prisma.repairJob.update({ where: { id }, data: updateData }),
        fastify.prisma.repairStatusLog.create({
          data: {
            repairId: id,
            fromStatus: repair.status,
            toStatus: body.status,
            changedById: user.sub,
            note: body.note,
          },
        }),
      ])

      return reply.send({ data: { ...updatedRepair, isOverdue: isOverdue(updatedRepair) } })
    },
  )

  // ── PATCH /:id/assign — Assign/update mechanics ─────────────────────────────
  fastify.patch(
    '/:id/assign',
    { preHandler: authorize(['manager']) },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      const body = request.body as {
        primaryMechanicId: string
        secondaryMechanicIds?: string[]
      }

      if (!body.primaryMechanicId) {
        throw Errors.BadRequest('primaryMechanicId is required', 'VALIDATION_ERROR')
      }

      const repair = await fastify.prisma.repairJob.findUnique({ where: { id } })
      if (!repair) throw Errors.NotFound('Repair', id)

      // Delete all existing mechanics, recreate with new assignment
      await fastify.prisma.$transaction([
        fastify.prisma.repairMechanic.deleteMany({ where: { repairId: id } }),
        fastify.prisma.repairMechanic.create({
          data: { repairId: id, mechanicId: body.primaryMechanicId, isPrimary: true },
        }),
        ...(body.secondaryMechanicIds ?? []).map((mid) =>
          fastify.prisma.repairMechanic.create({
            data: { repairId: id, mechanicId: mid, isPrimary: false },
          }),
        ),
      ])

      // Update primaryMechanicId on the RepairJob
      const updated = await fastify.prisma.repairJob.update({
        where: { id },
        data: { primaryMechanicId: body.primaryMechanicId },
        include: {
          mechanics: {
            include: { mechanic: { select: { id: true, name: true, specialty: true } } },
          },
        },
      })

      return reply.send({ data: updated })
    },
  )

  // ── POST /:id/diagnosis — Save/update diagnosis report ──────────────────────
  fastify.post(
    '/:id/diagnosis',
    { preHandler: authorize(['manager', 'mechanic']) },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      const user = request.user as JwtPayload
      const body = DiagnosisReportSchema.parse(request.body)

      const repair = await fastify.prisma.repairJob.findUnique({ where: { id } })
      if (!repair) throw Errors.NotFound('Repair', id)

      // Mechanic access check
      if (user.role === 'mechanic') {
        const assignment = await fastify.prisma.repairMechanic.findUnique({
          where: { repairId_mechanicId: { repairId: id, mechanicId: user.sub } },
        })
        if (!assignment) throw Errors.Forbidden('You are not assigned to this repair')
      }

      const updated = await fastify.prisma.repairJob.update({
        where: { id },
        data: {
          diagnosisReport: body as any,
          estimatedDurationHours: body.estimatedDurationHours ?? repair.estimatedDurationHours,
        },
      })

      return reply.send({ data: updated })
    },
  )

  // ── PATCH /:id/share-diagnosis — Share diagnosis with client ────────────────
  fastify.patch(
    '/:id/share-diagnosis',
    { preHandler: authorize(['manager']) },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      const user = request.user as JwtPayload

      const repair = await fastify.prisma.repairJob.findUnique({ where: { id } })
      if (!repair) throw Errors.NotFound('Repair', id)

      const statusChanging = repair.status === 'diagnosing'
      const updateData: Record<string, unknown> = { diagnosisShared: true }
      if (statusChanging) updateData.status = 'awaiting_approval'

      if (statusChanging) {
        const [updated] = await fastify.prisma.$transaction([
          fastify.prisma.repairJob.update({ where: { id }, data: updateData }),
          fastify.prisma.repairStatusLog.create({
            data: {
              repairId: id,
              fromStatus: repair.status,
              toStatus: 'awaiting_approval',
              changedById: user.sub,
              note: 'Diagnosis shared with client',
            },
          }),
        ])
        return reply.send({ data: updated })
      }

      const updated = await fastify.prisma.repairJob.update({ where: { id }, data: updateData })
      return reply.send({ data: updated })
    },
  )

  // ── PATCH /:id/client-approval — Record client approval ─────────────────────
  fastify.patch(
    '/:id/client-approval',
    { preHandler: authorize(['manager']) },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      const user = request.user as JwtPayload
      const body = ClientApprovalSchema.parse(request.body)
      const rawBody = request.body as { cancellationReason?: string }

      const repair = await fastify.prisma.repairJob.findUnique({ where: { id } })
      if (!repair) throw Errors.NotFound('Repair', id)

      if (body.status === 'approved') {
        const [updated] = await fastify.prisma.$transaction([
          fastify.prisma.repairJob.update({
            where: { id },
            data: { clientApprovalStatus: 'approved', status: 'in_progress' },
          }),
          fastify.prisma.repairStatusLog.create({
            data: {
              repairId: id,
              fromStatus: repair.status,
              toStatus: 'in_progress',
              changedById: user.sub,
              note: 'Client approved diagnosis',
            },
          }),
        ])
        return reply.send({ data: updated })
      }

      if (body.status === 'rejected') {
        const cancellationReason = rawBody.cancellationReason ?? 'Client rejected diagnosis'
        const [updated] = await fastify.prisma.$transaction([
          fastify.prisma.repairJob.update({
            where: { id },
            data: {
              clientApprovalStatus: 'rejected',
              status: 'cancelled',
              cancellationReason,
            },
          }),
          fastify.prisma.repairStatusLog.create({
            data: {
              repairId: id,
              fromStatus: repair.status,
              toStatus: 'cancelled',
              changedById: user.sub,
              note: cancellationReason,
            },
          }),
        ])
        return reply.send({ data: updated })
      }

      if (body.status === 'bypassed') {
        if (!body.bypassReason) {
          throw Errors.BusinessRule(
            'BYPASS_REASON_REQUIRED',
            'A bypass reason is required when bypassing client approval',
          )
        }
        const [updated] = await fastify.prisma.$transaction([
          fastify.prisma.repairJob.update({
            where: { id },
            data: {
              clientApprovalStatus: 'bypassed',
              clientApprovalBypassReason: body.bypassReason,
              status: 'in_progress',
            },
          }),
          fastify.prisma.repairStatusLog.create({
            data: {
              repairId: id,
              fromStatus: repair.status,
              toStatus: 'in_progress',
              changedById: user.sub,
              note: `Client approval bypassed: ${body.bypassReason}`,
            },
          }),
        ])
        return reply.send({ data: updated })
      }

      throw Errors.BadRequest(`Invalid approval status: ${body.status}`, 'INVALID_APPROVAL_STATUS')
    },
  )

  // ── POST /:id/work-logs — Add work log entry ────────────────────────────────
  fastify.post(
    '/:id/work-logs',
    { preHandler: authorize(['manager', 'mechanic']) },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      const user = request.user as JwtPayload
      const body = AddWorkLogSchema.parse(request.body)

      const repair = await fastify.prisma.repairJob.findUnique({ where: { id } })
      if (!repair) throw Errors.NotFound('Repair', id)

      // Mechanic access check
      if (user.role === 'mechanic') {
        const assignment = await fastify.prisma.repairMechanic.findUnique({
          where: { repairId_mechanicId: { repairId: id, mechanicId: user.sub } },
        })
        if (!assignment) throw Errors.Forbidden('You are not assigned to this repair')
      }

      const log = await fastify.prisma.repairWorkLog.create({
        data: {
          repairId: id,
          mechanicId: user.sub,
          description: body.description,
          hoursSpent: body.hoursSpent,
        },
        include: { mechanic: { select: { id: true, name: true } } },
      })

      return reply.status(201).send({ data: log })
    },
  )

  // ── GET /:id/work-logs — List work logs ─────────────────────────────────────
  fastify.get(
    '/:id/work-logs',
    { preHandler: authorize(['manager', 'mechanic']) },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      const query = request.query as { page?: string; limit?: string }

      const repair = await fastify.prisma.repairJob.findUnique({ where: { id } })
      if (!repair) throw Errors.NotFound('Repair', id)

      const { page, limit, skip } = getPaginationParams({
        page: query.page ? parseInt(query.page) : 1,
        limit: query.limit ? parseInt(query.limit) : 20,
      })

      const [logs, total] = await fastify.prisma.$transaction([
        fastify.prisma.repairWorkLog.findMany({
          where: { repairId: id },
          skip,
          take: limit,
          orderBy: { loggedAt: 'desc' },
          include: { mechanic: { select: { id: true, name: true } } },
        }),
        fastify.prisma.repairWorkLog.count({ where: { repairId: id } }),
      ])

      return reply.send(paginate(logs, total, page, limit))
    },
  )

  // ── GET /:id/status-logs — Status audit trail ───────────────────────────────
  fastify.get(
    '/:id/status-logs',
    { preHandler: authorize(['manager', 'mechanic']) },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }

      const repair = await fastify.prisma.repairJob.findUnique({ where: { id } })
      if (!repair) throw Errors.NotFound('Repair', id)

      const logs = await fastify.prisma.repairStatusLog.findMany({
        where: { repairId: id },
        orderBy: { createdAt: 'asc' },
        include: { changedBy: { select: { id: true, name: true } } },
      })

      return reply.send({ data: logs })
    },
  )

  // ── POST /:id/delay-report — File delay report ──────────────────────────────
  fastify.post(
    '/:id/delay-report',
    { preHandler: authorize(['manager']) },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      const user = request.user as JwtPayload
      const body = DelayReportSchema.parse(request.body)

      const repair = await fastify.prisma.repairJob.findUnique({ where: { id } })
      if (!repair) throw Errors.NotFound('Repair', id)

      if (!isOverdue(repair)) {
        throw Errors.BusinessRule('NOT_OVERDUE', 'This repair is not overdue')
      }

      const report = await fastify.prisma.delayReport.create({
        data: {
          repairId: id,
          reportedById: user.sub,
          reason: body.reason,
          evidenceNote: body.evidenceNote,
        },
      })

      return reply.status(201).send({ data: report })
    },
  )

  // ── POST /:id/parts — Assign part to repair ─────────────────────────────────
  fastify.post(
    '/:id/parts',
    { preHandler: authorize(['manager', 'mechanic']) },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      const user = request.user as JwtPayload
      const body = AssignPartSchema.parse(request.body)

      const repair = await fastify.prisma.repairJob.findUnique({ where: { id } })
      if (!repair) throw Errors.NotFound('Repair', id)

      // Mechanic access check
      if (user.role === 'mechanic') {
        const assignment = await fastify.prisma.repairMechanic.findUnique({
          where: { repairId_mechanicId: { repairId: id, mechanicId: user.sub } },
        })
        if (!assignment) throw Errors.Forbidden('You are not assigned to this repair')
      }

      // Get part and check stock
      const part = await fastify.prisma.part.findFirst({
        where: { id: body.partId, deletedAt: null },
      })
      if (!part) throw Errors.NotFound('Part', body.partId)

      if (part.quantity < body.quantityUsed) {
        if (!body.stockOverride) {
          throw Errors.BusinessRule(
            'INSUFFICIENT_STOCK',
            `Only ${part.quantity} units available. Use stockOverride to proceed.`,
          )
        }
      }

      const quantityAfter = part.quantity - body.quantityUsed

      const [repairPart] = await fastify.prisma.$transaction([
        fastify.prisma.repairPart.create({
          data: {
            repairId: id,
            partId: body.partId,
            quantityUsed: body.quantityUsed,
            unitCostAtTime: part.unitCost,
            stockOverride: body.stockOverride ?? false,
            addedById: user.sub,
          },
        }),
        fastify.prisma.part.update({
          where: { id: body.partId },
          data: { quantity: { decrement: body.quantityUsed } },
        }),
        fastify.prisma.stockTransaction.create({
          data: {
            partId: body.partId,
            type: 'used',
            quantityChange: -body.quantityUsed,
            quantityAfter,
            repairId: id,
            doneById: user.sub,
            note: body.stockOverride
              ? `Stock override by manager for repair ${id}`
              : undefined,
          },
        }),
      ])

      await recalculateRepairTotals(fastify, id)

      return reply.status(201).send({ data: repairPart })
    },
  )

  // ── DELETE /:id/parts/:repairPartId — Remove part from repair ───────────────
  fastify.delete(
    '/:id/parts/:repairPartId',
    { preHandler: authorize(['manager']) },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id, repairPartId } = request.params as { id: string; repairPartId: string }
      const user = request.user as JwtPayload

      const repair = await fastify.prisma.repairJob.findUnique({ where: { id } })
      if (!repair) throw Errors.NotFound('Repair', id)

      const repairPart = await fastify.prisma.repairPart.findUnique({
        where: { id: repairPartId },
      })
      if (!repairPart || repairPart.repairId !== id) {
        throw Errors.NotFound('RepairPart', repairPartId)
      }

      // Restore stock and create reversal stock transaction
      const part = await fastify.prisma.part.findUnique({ where: { id: repairPart.partId } })
      const quantityAfter = (part?.quantity ?? 0) + repairPart.quantityUsed

      await fastify.prisma.$transaction([
        fastify.prisma.repairPart.delete({ where: { id: repairPartId } }),
        fastify.prisma.part.update({
          where: { id: repairPart.partId },
          data: { quantity: { increment: repairPart.quantityUsed } },
        }),
        fastify.prisma.stockTransaction.create({
          data: {
            partId: repairPart.partId,
            type: 'adjustment',
            quantityChange: repairPart.quantityUsed,
            quantityAfter,
            repairId: id,
            doneById: user.sub,
            note: `Part removed from repair ${id} — stock reversed`,
          },
        }),
      ])

      await recalculateRepairTotals(fastify, id)

      return reply.send({ data: { message: 'Part removed from repair and stock restored' } })
    },
  )

  // ── POST /:id/labor — Add labor item ────────────────────────────────────────
  fastify.post(
    '/:id/labor',
    { preHandler: authorize(['manager', 'mechanic']) },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      const user = request.user as JwtPayload
      const body = AddLaborItemSchema.parse(request.body)

      const repair = await fastify.prisma.repairJob.findUnique({ where: { id } })
      if (!repair) throw Errors.NotFound('Repair', id)

      // Mechanic access check
      if (user.role === 'mechanic') {
        const assignment = await fastify.prisma.repairMechanic.findUnique({
          where: { repairId_mechanicId: { repairId: id, mechanicId: user.sub } },
        })
        if (!assignment) throw Errors.Forbidden('You are not assigned to this repair')
      }

      const laborItem = await fastify.prisma.laborItem.create({
        data: {
          repairId: id,
          description: body.description,
          cost: body.cost,
          addedById: user.sub,
        },
      })

      await recalculateRepairTotals(fastify, id)

      return reply.status(201).send({ data: laborItem })
    },
  )

  // ── PATCH /:id/labor/:itemId — Update labor item ────────────────────────────
  fastify.patch(
    '/:id/labor/:itemId',
    { preHandler: authorize(['manager']) },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id, itemId } = request.params as { id: string; itemId: string }
      const body = request.body as { description?: string; cost?: number }

      const repair = await fastify.prisma.repairJob.findUnique({ where: { id } })
      if (!repair) throw Errors.NotFound('Repair', id)

      const laborItem = await fastify.prisma.laborItem.findUnique({ where: { id: itemId } })
      if (!laborItem || laborItem.repairId !== id) throw Errors.NotFound('LaborItem', itemId)

      const updated = await fastify.prisma.laborItem.update({
        where: { id: itemId },
        data: {
          ...(body.description !== undefined && { description: body.description }),
          ...(body.cost !== undefined && { cost: body.cost }),
        },
      })

      await recalculateRepairTotals(fastify, id)

      return reply.send({ data: updated })
    },
  )

  // ── DELETE /:id/labor/:itemId — Remove labor item ───────────────────────────
  fastify.delete(
    '/:id/labor/:itemId',
    { preHandler: authorize(['manager']) },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id, itemId } = request.params as { id: string; itemId: string }

      const repair = await fastify.prisma.repairJob.findUnique({ where: { id } })
      if (!repair) throw Errors.NotFound('Repair', id)

      const laborItem = await fastify.prisma.laborItem.findUnique({ where: { id: itemId } })
      if (!laborItem || laborItem.repairId !== id) throw Errors.NotFound('LaborItem', itemId)

      await fastify.prisma.laborItem.delete({ where: { id: itemId } })
      await recalculateRepairTotals(fastify, id)

      return reply.send({ data: { message: 'Labor item removed' } })
    },
  )

  // ── GET /:id/mechanics — List mechanics assigned to repair ──────────────────
  fastify.get(
    '/:id/mechanics',
    { preHandler: authorize(['manager', 'mechanic']) },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }

      const repair = await fastify.prisma.repairJob.findUnique({ where: { id } })
      if (!repair) throw Errors.NotFound('Repair', id)

      const mechanics = await fastify.prisma.repairMechanic.findMany({
        where: { repairId: id },
        include: {
          mechanic: {
            select: { id: true, name: true, specialty: true, role: true, status: true },
          },
        },
      })

      return reply.send({ data: mechanics })
    },
  )
}
