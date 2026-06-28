import fp from 'fastify-plugin'
import { FastifyInstance } from 'fastify'
import fastifyRateLimit from '@fastify/rate-limit'

async function rateLimitPlugin(fastify: FastifyInstance) {
  await fastify.register(fastifyRateLimit, {
    global: true,
    max: 300,
    timeWindow: '1 minute',
    errorResponseBuilder: () => ({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please try again later.',
        statusCode: 429,
      },
    }),
  })
}

export default fp(rateLimitPlugin, { name: 'rate-limit' })
export { rateLimitPlugin }
