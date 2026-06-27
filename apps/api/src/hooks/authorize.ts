import { FastifyRequest, FastifyReply } from 'fastify'
import { JwtPayload } from '../plugins/jwt'

export function authorize(allowedRoles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    await request.server.authenticate(request, reply)

    if (reply.sent) return // authenticate already replied with error

    const user = request.user as JwtPayload
    if (!allowedRoles.includes(user.role)) {
      return reply.status(403).send({
        error: {
          code: 'FORBIDDEN',
          message: `This action requires one of these roles: ${allowedRoles.join(', ')}`,
          statusCode: 403,
        },
      })
    }
  }
}
