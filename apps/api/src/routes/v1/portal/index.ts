import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { Errors } from '../../../utils/errors'

function isRepairOverdue(repair: { status: string; targetCompletionDate: Date | null }): boolean {
  if (!repair.targetCompletionDate) return false
  const finishedStatuses = ['complete', 'delivered', 'cancelled']
  if (finishedStatuses.includes(repair.status)) return false
  return new Date() > repair.targetCompletionDate
}

export async function portalRoutes(fastify: FastifyInstance) {
  // All portal routes require client auth
  fastify.addHook('preHandler', (req: FastifyRequest, rep: FastifyReply) =>
    fastify.authenticateClient(req, rep),
  )

  // GET /me — current client profile
  fastify.get('/me', async (request: FastifyRequest, reply: FastifyReply) => {
    const client = await fastify.prisma.client.findUnique({
      where: { id: request.user.sub },
      select: { id: true, name: true, phone: true, createdAt: true },
    })
    if (!client) throw Errors.NotFound('Client')
    return reply.send({ data: client })
  })

  // GET /cars — client's cars with active repair status
  fastify.get('/cars', async (request: FastifyRequest, reply: FastifyReply) => {
    const cars = await fastify.prisma.car.findMany({
      where: { clientId: request.user.sub, deletedAt: null },
      include: {
        repairs: {
          where: { status: { notIn: ['delivered', 'cancelled'] } },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            primaryMechanic: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const result = cars.map(car => ({
      id: car.id,
      matricule: car.matricule,
      make: car.make,
      model: car.model,
      year: car.year,
      color: car.color,
      activeRepair: car.repairs[0]
        ? {
            id: car.repairs[0].id,
            status: car.repairs[0].status,
            priority: car.repairs[0].priority,
            targetCompletionDate: car.repairs[0].targetCompletionDate,
            isOverdue: isRepairOverdue(car.repairs[0]),
            description: car.repairs[0].description,
            mechanicName: car.repairs[0].primaryMechanic.name,
          }
        : null,
    }))

    return reply.send({ data: result })
  })

  // GET /repairs/:id — single repair detail (BR-011: must belong to client's car)
  fastify.get('/repairs/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }

    const repair = await fastify.prisma.repairJob.findUnique({
      where: { id },
      include: {
        car: { include: { client: true } },
        primaryMechanic: { select: { name: true } },
        statusLogs: {
          orderBy: { createdAt: 'asc' },
          include: { changedBy: { select: { name: true } } },
        },
        parts: { include: { part: { select: { name: true, reference: true } } } },
        laborItems: true,
        payment: { select: { invoiceNumber: true, finalTotal: true, createdAt: true } },
        delayReports: { select: { id: true } },
      },
    })

    if (!repair) throw Errors.NotFound('Repair', id)

    // BR-011: Verify this car belongs to the requesting client
    if (repair.car.clientId !== request.user.sub) {
      throw Errors.Forbidden('You do not have access to this repair')
    }

    return reply.send({
      data: {
        id: repair.id,
        status: repair.status,
        priority: repair.priority,
        description: repair.description,
        isOverdue: isRepairOverdue(repair),
        diagnosisShared: repair.diagnosisShared,
        diagnosisReport: repair.diagnosisShared ? repair.diagnosisReport : null,
        estimatedCost: repair.estimatedCost?.toNumber() ?? null,
        finalTotal: repair.finalTotal.toNumber(),
        targetCompletionDate: repair.targetCompletionDate,
        actualCompletionDate: repair.actualCompletionDate,
        createdAt: repair.createdAt,
        car: {
          id: repair.car.id,
          matricule: repair.car.matricule,
          make: repair.car.make,
          model: repair.car.model,
          year: repair.car.year,
          color: repair.car.color,
        },
        primaryMechanic: repair.primaryMechanic,
        statusLogs: repair.statusLogs,
        payment: repair.payment,
      },
    })
  })

  // GET /appointments — client's own appointments (last 10)
  fastify.get('/appointments', async (request: FastifyRequest, reply: FastifyReply) => {
    const appointments = await fastify.prisma.appointment.findMany({
      where: { clientId: request.user.sub, deletedAt: null },
      orderBy: { requestedAt: 'desc' },
      take: 10,
    })
    return reply.send({ data: appointments })
  })

  // POST /appointments — client books an appointment
  fastify.post('/appointments', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as {
      carId?: string
      carMatricule?: string
      purpose: string
      requestedAt: string
      notes?: string
    }

    const client = await fastify.prisma.client.findUnique({ where: { id: request.user.sub } })
    if (!client) throw Errors.NotFound('Client')

    if (!body.purpose || body.purpose.length < 5) {
      throw Errors.ValidationError('Purpose must be at least 5 characters')
    }

    // createdById references User table — find any active manager as proxy creator
    const defaultManager = await fastify.prisma.user.findFirst({
      where: { role: 'manager', status: 'active' },
    })
    if (!defaultManager) throw Errors.BadRequest('No active manager found in system')

    const appointment = await fastify.prisma.appointment.create({
      data: {
        clientId: request.user.sub,
        clientName: client.name,
        clientPhone: client.phone,
        carId: body.carId ?? null,
        carMatricule: body.carMatricule ? body.carMatricule.toUpperCase() : null,
        purpose: body.purpose,
        requestedAt: new Date(body.requestedAt),
        notes: body.notes,
        status: 'pending',
        createdById: defaultManager.id,
      },
    })

    return reply.status(201).send({ data: appointment })
  })
}
