import { FastifyInstance } from 'fastify'

export async function healthRoute(fastify: FastifyInstance) {
  fastify.get('/health', async (request, reply) => {
    let dbStatus = 'ok'
    try {
      await fastify.prisma.$queryRaw`SELECT 1`
    } catch {
      dbStatus = 'error'
    }

    const health = {
      status: dbStatus === 'ok' ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: dbStatus,
      version: '1.0.0',
    }

    reply.status(health.status === 'ok' ? 200 : 503).send(health)
  })
}
