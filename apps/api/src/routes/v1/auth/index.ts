import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import bcrypt from 'bcryptjs'
import { LoginSchema, RegisterSchema } from '@sagman/shared'
import { Errors } from '../../../utils/errors'
import { JwtPayload } from '../../../plugins/jwt'

export async function authRoutes(fastify: FastifyInstance) {
  // ─── EMPLOYEE/MANAGER AUTHENTICATION ──────────────────────────────────────


  // POST /api/v1/auth/register
  fastify.post(
    '/register',
    {
      config: { rateLimit: { max: 3, timeWindow: '1 hour' } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = RegisterSchema.parse(request.body)

      // Check if user with phone already exists
      const existingUser = await fastify.prisma.user.findUnique({
        where: { phone: body.phone },
      })

      if (existingUser) {
        throw Errors.BadRequest('A user with this phone number already exists')
      }

      // Check if user with email already exists
      const existingUserByEmail = await fastify.prisma.user.findUnique({
        where: { email: body.phone },
      })

      if (existingUserByEmail) {
        throw Errors.BadRequest('A user with this phone number already exists')
      }

      const passwordHash = await bcrypt.hash(body.password, 10)

      const user = await fastify.prisma.user.create({
        data: {
          name: body.name,
          phone: body.phone,
          email: body.phone, // Store phone as email for compatibility
          passwordHash,
          role: body.role as any,
          specialty: body.specialty ?? undefined,
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

      return reply.status(201).send({
        data: {
          user,
          message: 'Account created successfully',
        },
      })
    },
  )

  // POST /api/v1/auth/login
  fastify.post(
    '/login',
    {
      config: { rateLimit: { max: 5, timeWindow: '15 minutes' } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = LoginSchema.parse(request.body)

      // Try to find user by phone or email
      const user = await fastify.prisma.user.findFirst({
        where: {
          OR: [
            { phone: body.identifier },
            { email: body.identifier },
          ],
        },
      })

      if (!user) {
        throw Errors.Unauthorized('Invalid credentials')
      }

      if (user.status !== 'active') {
        throw Errors.Unauthorized('Your account has been deactivated')
      }

      const passwordValid = await bcrypt.compare(body.password, user.passwordHash)
      if (!passwordValid) {
        throw Errors.Unauthorized('Invalid credentials')
      }

      const accessToken = fastify.jwt.sign(
        { sub: user.id, role: user.role, type: 'access' },
        { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '8h' },
      )

      const refreshToken = fastify.jwt.sign(
        { sub: user.id, role: user.role, type: 'refresh' },
        { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '30d' },
      )

      return reply.send({
        data: {
          accessToken,
          refreshToken,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            phone: user.phone,
          },
        },
      })
    },
  )

  // POST /api/v1/auth/refresh
  fastify.post('/refresh', async (request: FastifyRequest, reply: FastifyReply) => {
    const { refreshToken } = request.body as { refreshToken: string }

    if (!refreshToken) {
      throw Errors.BadRequest('Refresh token required')
    }

    try {
      const payload = fastify.jwt.verify(refreshToken) as any
      if (payload.type !== 'refresh') {
        throw Errors.Unauthorized('Invalid token type')
      }

      // Verify user still active
      const user = await fastify.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, role: true, status: true },
      })

      if (!user || user.status !== 'active') {
        throw Errors.Unauthorized('Account not found or deactivated')
      }

      const accessToken = fastify.jwt.sign(
        { sub: user.id, role: user.role, type: 'access' },
        { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '8h' },
      )

      return reply.send({ data: { accessToken } })
    } catch (err: any) {
      if (err.statusCode) throw err
      throw Errors.Unauthorized('Invalid or expired refresh token')
    }
  })

  // POST /api/v1/auth/logout
  fastify.post(
    '/logout',
    {
      preHandler: [fastify.authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Stateless JWT — client should discard tokens
      return reply.send({ data: { message: 'Logged out successfully' } })
    },
  )

  // ─── PORTAL CLIENT AUTHENTICATION (Phone + Password) ────────────────────────

  // POST /api/v1/auth/portal/register — create a new client account
  fastify.post(
    '/portal/register',
    {
      config: { rateLimit: { max: 5, timeWindow: '1 hour' } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as {
        name: string
        phone: string
        password: string
      }

      if (!body.name || body.name.length < 2) {
        throw Errors.ValidationError('Name must be at least 2 characters')
      }

      if (!body.phone || !/^\+?[1-9]\d{7,14}$/.test(body.phone)) {
        throw Errors.ValidationError('Invalid phone number format')
      }

      if (!body.password || body.password.length < 6) {
        throw Errors.ValidationError('Password must be at least 6 characters')
      }

      // Check if user with phone already exists
      const existingUser = await fastify.prisma.user.findUnique({
        where: { phone: body.phone },
      })

      if (existingUser) {
        throw Errors.BadRequest('A user with this phone number already exists')
      }

      const passwordHash = await bcrypt.hash(body.password, 10)

      // Create user with a client-friendly role (using 'overseer' as placeholder for client)
      // This is a temporary approach; consider adding a dedicated Client model or role later
      const user = await fastify.prisma.user.create({
        data: {
          name: body.name,
          phone: body.phone,
          email: `client_${body.phone}@sagman.local`, // Pseudo-email for compatibility
          passwordHash,
          role: 'overseer', // or could create a dedicated role
          status: 'active',
        },
        select: {
          id: true,
          name: true,
          phone: true,
          createdAt: true,
        },
      })

      return reply.status(201).send({
        data: {
          user,
          message: 'Account created successfully',
        },
      })
    },
  )

  // POST /api/v1/auth/portal/login — client login with phone & password
  fastify.post(
    '/portal/login',
    {
      config: { rateLimit: { max: 5, timeWindow: '15 minutes' } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as {
        phone: string
        password: string
      }

      if (!body.phone) {
        throw Errors.ValidationError('Phone number required')
      }

      if (!body.password) {
        throw Errors.ValidationError('Password required')
      }

      // Find user by phone (clients)
      const user = await fastify.prisma.user.findUnique({
        where: { phone: body.phone },
      })

      if (!user) {
        throw Errors.Unauthorized('Invalid credentials')
      }

      if (user.status !== 'active') {
        throw Errors.Unauthorized('Your account has been deactivated')
      }

      const passwordValid = await bcrypt.compare(body.password, user.passwordHash)
      if (!passwordValid) {
        throw Errors.Unauthorized('Invalid credentials')
      }

      const accessToken = fastify.jwt.sign(
        { sub: user.id, role: user.role, type: 'client' } as JwtPayload,
        { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '8h' },
      )

      return reply.send({
        data: {
          accessToken,
          client: {
            id: user.id,
            name: user.name,
            phone: user.phone,
          },
        },
      })
    },
  )
}
