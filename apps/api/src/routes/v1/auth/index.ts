import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import bcrypt from 'bcryptjs'
import { LoginSchema, RequestOtpSchema, VerifyOtpSchema } from '@sagman/shared'
import { OtpService } from '../../../services/otp.service'
import { Errors } from '../../../utils/errors'

export async function authRoutes(fastify: FastifyInstance) {
  // POST /api/v1/auth/login
  fastify.post(
    '/login',
    {
      config: { rateLimit: { max: 5, timeWindow: '15 minutes' } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = LoginSchema.parse(request.body)

      const user = await fastify.prisma.user.findUnique({
        where: { email: body.email },
      })

      if (!user) {
        throw Errors.Unauthorized('Invalid email or password')
      }

      if (user.status !== 'active') {
        throw Errors.Unauthorized('Your account has been deactivated')
      }

      const passwordValid = await bcrypt.compare(body.password, user.passwordHash)
      if (!passwordValid) {
        throw Errors.Unauthorized('Invalid email or password')
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

  // POST /api/v1/auth/portal/request-otp
  fastify.post(
    '/portal/request-otp',
    {
      config: { rateLimit: { max: 3, timeWindow: '10 minutes' } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { phone } = RequestOtpSchema.parse(request.body)

      const otp = OtpService.generate()
      const otpExpiresAt = OtpService.getExpiry()

      // Upsert client — create if first time
      await fastify.prisma.client.upsert({
        where: { phone },
        create: {
          phone,
          name: phone, // Will be updated when client provides name
          otpCode: otp,
          otpExpiresAt,
        },
        update: {
          otpCode: otp,
          otpExpiresAt,
        },
      })

      // In production: send OTP via SMS provider
      // In development: return OTP in response for testing
      const response: Record<string, any> = {
        data: { message: 'OTP sent to your phone number' },
      }
      if (process.env.NODE_ENV === 'development') {
        response.data._devOtp = otp
      }

      return reply.send(response)
    },
  )

  // POST /api/v1/auth/portal/verify-otp
  fastify.post('/portal/verify-otp', async (request: FastifyRequest, reply: FastifyReply) => {
    const { phone, otp } = VerifyOtpSchema.parse(request.body)

    const client = await fastify.prisma.client.findUnique({
      where: { phone },
    })

    if (!client) {
      throw Errors.Unauthorized('No OTP request found for this phone number')
    }

    if (!OtpService.isValid(client.otpCode, client.otpExpiresAt, otp)) {
      throw Errors.Unauthorized('Invalid or expired OTP')
    }

    // Clear OTP after successful verification
    await fastify.prisma.client.update({
      where: { phone },
      data: { otpCode: null, otpExpiresAt: null },
    })

    const accessToken = fastify.jwt.sign(
      { sub: client.id, role: 'client', type: 'client' },
      { expiresIn: '7d' },
    )

    return reply.send({
      data: {
        accessToken,
        client: {
          id: client.id,
          name: client.name,
          phone: client.phone,
        },
      },
    })
  })
}
