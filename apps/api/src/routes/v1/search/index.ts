import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { authorize } from '../../../hooks/authorize'

export async function searchRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/',
    { preHandler: [authorize(['manager'])] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { q, limit } = request.query as { q?: string; limit?: string }

      if (!q || q.trim().length < 2) {
        return reply.send({ data: { cars: [], clients: [], repairs: [], invoices: [] } })
      }

      const searchTerm = q.trim()
      const lim = Math.min(parseInt(limit ?? '5'), 10)

      const [cars, clients, repairs, invoices] = await Promise.all([
        // Cars by matricule
        fastify.prisma.car.findMany({
          where: {
            deletedAt: null,
            matricule: { contains: searchTerm, mode: 'insensitive' },
          },
          select: { id: true, matricule: true, make: true, model: true, year: true },
          take: lim,
        }),

        // Clients by name or phone
        fastify.prisma.client.findMany({
          where: {
            OR: [
              { name: { contains: searchTerm, mode: 'insensitive' } },
              { phone: { contains: searchTerm } },
            ],
          },
          select: { id: true, name: true, phone: true },
          take: lim,
        }),

        // Repairs by ID prefix
        fastify.prisma.repairJob.findMany({
          where: { id: { startsWith: searchTerm } },
          select: {
            id: true,
            status: true,
            priority: true,
            description: true,
            car: { select: { matricule: true, make: true, model: true } },
          },
          take: lim,
        }),

        // Invoices by invoice number
        fastify.prisma.payment.findMany({
          where: { invoiceNumber: { contains: searchTerm, mode: 'insensitive' } },
          select: {
            id: true,
            invoiceNumber: true,
            finalTotal: true,
            createdAt: true,
            repair: { select: { id: true, car: { select: { matricule: true } } } },
          },
          take: lim,
        }),
      ])

      return reply.send({ data: { cars, clients, repairs, invoices } })
    },
  )
}
