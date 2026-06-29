import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { UpdateSettingsSchema } from '@sagman/shared'
import { authorize } from '../../../hooks/authorize'
import { Errors } from '../../../utils/errors'

export async function settingsRoutes(fastify: FastifyInstance) {
  // GET /api/v1/settings/public — public info for portal
  fastify.get(
    '/public',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const publicKeys = [
        'garage_name',
        'garage_phone', 
        'garage_address',
        'garage_hours',
        'garage_email'
      ]
      
      const settings = await fastify.prisma.systemSettings.findMany({
        where: { key: { in: publicKeys } }
      })

      const settingsMap = settings.reduce((acc: Record<string, string>, s) => {
        acc[s.key] = s.value
        return acc
      }, {})

      // Set defaults if not configured
      const defaults = {
        garage_name: 'Garage Sagman',
        garage_phone: '+212 6 XX XX XX XX',
        garage_address: 'Casablanca, Morocco',
        garage_hours: 'Lun-Sam: 8h-18h',
        garage_email: 'contact@sagman.ma'
      }

      const result = { ...defaults, ...settingsMap }
      return reply.send({ data: result })
    }
  )

  // GET /api/v1/settings — accessible to manager and overseer
  fastify.get(
    '/',
    {
      preHandler: [authorize(['manager', 'overseer'])],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const settings = await fastify.prisma.systemSettings.findMany()

      // Convert array to key-value object
      const settingsMap = settings.reduce((acc: Record<string, string>, s) => {
        acc[s.key] = s.value
        return acc
      }, {})

      return reply.send({ data: settingsMap })
    },
  )

  // PATCH /api/v1/settings — manager only
  fastify.patch(
    '/',
    {
      preHandler: [authorize(['manager'])],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = UpdateSettingsSchema.parse(request.body)

      // Build upsert operations
      const updates = Object.entries(body).filter(([, v]) => v !== undefined) as [string, string][]

      if (updates.length === 0) {
        throw Errors.BadRequest('No settings provided to update')
      }

      await fastify.prisma.$transaction(
        updates.map(([key, value]) =>
          fastify.prisma.systemSettings.upsert({
            where: { key },
            create: { key, value: String(value) },
            update: { value: String(value) },
          }),
        ),
      )

      const allSettings = await fastify.prisma.systemSettings.findMany()
      const settingsMap = allSettings.reduce((acc: Record<string, string>, s) => {
        acc[s.key] = s.value
        return acc
      }, {})

      return reply.send({ data: settingsMap })
    },
  )
}
