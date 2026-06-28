import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import bcrypt from 'bcryptjs'
import { CreateEmployeeSchema, UpdateEmployeeSchema, ResetPasswordSchema } from '@sagman/shared'
import { authorize } from '../../../hooks/authorize'
import { Errors } from '../../../utils/errors'
import { getPaginationParams, paginate } from '../../../utils/pagination'

export async function employeeRoutes(fastify: FastifyInstance) {
  // All employee routes require manager role
  fastify.addHook('preHandler', authorize(['manager']))

  // GET /api/v1/employees
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as {
      status?: string
      role?: string
      page?: string
      limit?: string
    }
    const { page, limit, skip } = getPaginationParams({
      page: query.page ? parseInt(query.page) : 1,
      limit: query.limit ? parseInt(query.limit) : 50,
    })

    const where: Record<string, unknown> = {}
    if (query.status) where.status = query.status
    if (query.role) where.role = query.role

    const [users, total] = await fastify.prisma.$transaction([
      fastify.prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          phone: true,
          specialty: true,
          status: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      fastify.prisma.user.count({ where }),
    ])

    return reply.send(paginate(users, total, page, limit))
  })

  // POST /api/v1/employees
  fastify.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = CreateEmployeeSchema.parse(request.body)

    // Check email uniqueness
    const existing = await fastify.prisma.user.findUnique({
      where: { email: body.email },
    })
    if (existing) {
      throw Errors.Conflict(`An employee with email '${body.email}' already exists`)
    }

    const passwordHash = await bcrypt.hash(body.password, 12)

    const user = await fastify.prisma.user.create({
      data: {
        name: body.name,
        email: body.email,
        passwordHash,
        role: body.role,
        phone: body.phone,
        specialty: body.specialty,
        status: 'active',
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        specialty: true,
        status: true,
        createdAt: true,
      },
    })

    return reply.status(201).send({ data: user })
  })

  // GET /api/v1/employees/:id
  fastify.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }

    const user = await fastify.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        specialty: true,
        status: true,
        createdAt: true,
        _count: {
          select: { primaryRepairs: true, workLogs: true },
        },
      },
    })

    if (!user) throw Errors.NotFound('Employee', id)

    return reply.send({ data: user })
  })

  // PATCH /api/v1/employees/:id
  fastify.patch('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    const body = UpdateEmployeeSchema.parse(request.body)

    const existing = await fastify.prisma.user.findUnique({ where: { id } })
    if (!existing) throw Errors.NotFound('Employee', id)

    // If changing email, check uniqueness
    if (body.email && body.email !== existing.email) {
      const emailTaken = await fastify.prisma.user.findUnique({ where: { email: body.email } })
      if (emailTaken) throw Errors.Conflict(`Email '${body.email}' is already in use`)
    }

    const updated = await fastify.prisma.user.update({
      where: { id },
      data: {
        ...(body.name && { name: body.name }),
        ...(body.email && { email: body.email }),
        ...(body.phone !== undefined && { phone: body.phone }),
        ...(body.specialty !== undefined && { specialty: body.specialty }),
        ...(body.role && { role: body.role }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        specialty: true,
        status: true,
        createdAt: true,
      },
    })

    return reply.send({ data: updated })
  })

  // PATCH /api/v1/employees/:id/deactivate — BR-009, BR-010
  fastify.patch('/:id/deactivate', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }

    const user = await fastify.prisma.user.findUnique({ where: { id } })
    if (!user) throw Errors.NotFound('Employee', id)

    if (user.status === 'inactive') {
      throw Errors.BadRequest('Employee is already inactive')
    }

    // BR-010: Cannot deactivate the last active manager
    if (user.role === 'manager') {
      const activeManagerCount = await fastify.prisma.user.count({
        where: { role: 'manager', status: 'active' },
      })
      if (activeManagerCount <= 1) {
        throw Errors.BusinessRule(
          'LAST_MANAGER',
          'Cannot deactivate the last active Manager. Promote another employee first.',
        )
      }
    }

    const updated = await fastify.prisma.user.update({
      where: { id },
      data: { status: 'inactive' },
      select: { id: true, name: true, status: true },
    })

    return reply.send({ data: updated })
  })

  // PATCH /api/v1/employees/:id/activate
  fastify.patch('/:id/activate', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }

    const user = await fastify.prisma.user.findUnique({ where: { id } })
    if (!user) throw Errors.NotFound('Employee', id)

    const updated = await fastify.prisma.user.update({
      where: { id },
      data: { status: 'active' },
      select: { id: true, name: true, status: true },
    })

    return reply.send({ data: updated })
  })

  // PATCH /api/v1/employees/:id/reset-password
  fastify.patch('/:id/reset-password', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    const body = ResetPasswordSchema.parse(request.body)

    const user = await fastify.prisma.user.findUnique({ where: { id } })
    if (!user) throw Errors.NotFound('Employee', id)

    const passwordHash = await bcrypt.hash(body.newPassword, 12)

    await fastify.prisma.user.update({
      where: { id },
      data: { passwordHash },
    })

    return reply.send({ data: { message: 'Password reset successfully' } })
  })
}
