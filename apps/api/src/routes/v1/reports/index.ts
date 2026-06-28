import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { authorize } from '../../../hooks/authorize'
import { JwtPayload } from '../../../plugins/jwt'

export async function reportRoutes(fastify: FastifyInstance) {
  // GET /end-of-day — auto-generate report content
  fastify.get(
    '/end-of-day',
    { preHandler: [authorize(['manager'])] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const today = new Date()
      const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
      const dayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)

      const [
        carsReceived,
        carsDelivered,
        activeRepairs,
        overdueRepairs,
        lowStockParts,
        revenue,
      ] = await Promise.all([
        fastify.prisma.repairJob.findMany({
          where: { createdAt: { gte: dayStart, lt: dayEnd } },
          include: { car: { select: { matricule: true, make: true, model: true } } },
        }),

        fastify.prisma.repairJob.findMany({
          where: { status: 'delivered', actualCompletionDate: { gte: dayStart, lt: dayEnd } },
          include: {
            car: { select: { matricule: true, make: true, model: true } },
            payment: { select: { finalTotal: true } },
          },
        }),

        fastify.prisma.repairJob.findMany({
          where: { status: { notIn: ['delivered', 'cancelled'] } },
          include: {
            car: { select: { matricule: true, make: true, model: true } },
            primaryMechanic: { select: { name: true } },
          },
          orderBy: { priority: 'desc' },
        }),

        fastify.prisma.repairJob.findMany({
          where: {
            status: { notIn: ['complete', 'delivered', 'cancelled'] },
            targetCompletionDate: { lt: today },
          },
          include: {
            car: { select: { matricule: true, make: true, model: true } },
            delayReports: { orderBy: { createdAt: 'desc' }, take: 1 },
          },
        }),

        fastify.prisma.$queryRaw<
          Array<{ name: string; quantity: number; min_threshold: number }>
        >`
          SELECT name, quantity, min_threshold FROM parts
          WHERE quantity <= min_threshold AND deleted_at IS NULL
        `,

        fastify.prisma.payment.aggregate({
          _sum: { finalTotal: true },
          where: { createdAt: { gte: dayStart, lt: dayEnd } },
        }),
      ])

      const totalRevenue = revenue._sum.finalTotal?.toNumber() ?? 0

      return reply.send({
        data: {
          date: dayStart.toISOString(),
          carsReceived: carsReceived.map(r => ({ id: r.id, car: r.car })),
          carsDelivered: carsDelivered.map(r => ({
            id: r.id,
            car: r.car,
            revenue: r.payment?.finalTotal.toNumber() ?? 0,
          })),
          totalRevenue,
          activeRepairs: activeRepairs.map(r => ({
            id: r.id,
            car: r.car,
            status: r.status,
            mechanic: r.primaryMechanic.name,
          })),
          overdueRepairs: overdueRepairs.map(r => ({
            id: r.id,
            car: r.car,
            reason: r.delayReports[0]?.reason ?? 'Aucune raison documentée',
            daysSinceTarget: r.targetCompletionDate
              ? Math.floor((today.getTime() - r.targetCompletionDate.getTime()) / 86400000)
              : 0,
          })),
          lowStockParts: lowStockParts.map(p => ({
            name: p.name,
            quantity: p.quantity,
            minThreshold: p.min_threshold,
          })),
        },
      })
    },
  )

  // POST /end-of-day/send — build T-06 WhatsApp message and wa.me URL
  fastify.post(
    '/end-of-day/send',
    { preHandler: [authorize(['manager'])] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as JwtPayload
      const body = request.body as {
        notes: string
        reportData: {
          date: string
          carsReceived: Array<{ car: { make: string; model: string; matricule: string } }>
          carsDelivered: Array<{
            car: { make: string; model: string; matricule: string }
            revenue: number
          }>
          totalRevenue: number
          activeRepairs: Array<{
            car: { make: string; model: string; matricule: string }
            status: string
            mechanic: string
          }>
          overdueRepairs: Array<{
            car: { make: string; model: string; matricule: string }
            reason: string
            daysSinceTarget: number
          }>
          lowStockParts: Array<{ name: string; quantity: number; minThreshold: number }>
        }
      }

      const settings = await fastify.prisma.systemSettings.findMany({
        where: { key: { in: ['overseer_whatsapp_number', 'garage_name'] } },
      })
      const settingsMap = Object.fromEntries(settings.map(s => [s.key, s.value]))
      const overseerPhone = settingsMap['overseer_whatsapp_number'] ?? ''
      const garageName = settingsMap['garage_name'] ?? 'Garage Sagman'

      const managerUser = await fastify.prisma.user.findUnique({
        where: { id: user.sub },
        select: { name: true },
      })

      const d = body.reportData
      const date = new Date(d.date).toLocaleDateString('fr-FR')
      const time = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

      const activeList =
        d.activeRepairs
          .map(r => `• ${r.car.make} ${r.car.model} — ${r.car.matricule} — ${r.status} — ${r.mechanic}`)
          .join('\n') || 'Aucun'

      const overdueList =
        d.overdueRepairs.length > 0
          ? d.overdueRepairs
              .map(
                r =>
                  `• ${r.car.make} ${r.car.model} — ${r.car.matricule}\n  Retard: ${r.daysSinceTarget}j\n  Raison: ${r.reason}`,
              )
              .join('\n')
          : 'AUCUN RETARD'

      const stockList =
        d.lowStockParts.length > 0
          ? d.lowStockParts
              .map(p => `• ${p.name} — Qté: ${p.quantity} (min: ${p.minThreshold})`)
              .join('\n')
          : 'AUCUNE ALERTE'

      const separator = '═'.repeat(24)
      const divider = '─'.repeat(16)

      const message = [
        `RAPPORT JOURNALIER`,
        `${garageName.toUpperCase()}`,
        separator,
        `📅 Date : ${date}`,
        `⏰ Heure : ${time}`,
        `👤 Responsable : ${managerUser?.name ?? 'Manager'}`,
        ``,
        `ACTIVITÉ DU JOUR`,
        divider,
        `Véhicules reçus    : ${d.carsReceived.length}`,
        `Véhicules livrés   : ${d.carsDelivered.length}`,
        `Chiffre d'affaires : ${d.totalRevenue.toFixed(2)} DH`,
        ``,
        `ATELIER EN COURS (${d.activeRepairs.length} véhicules)`,
        divider,
        activeList,
        ``,
        `RETARDS`,
        divider,
        overdueList,
        ``,
        `ALERTES STOCK`,
        divider,
        stockList,
        ``,
        `NOTES DU RESPONSABLE`,
        divider,
        body.notes || '(Aucune note)',
        ``,
        separator,
        garageName,
      ].join('\n')

      await fastify.prisma.notificationLog.create({
        data: {
          type: 'T-06',
          recipientPhone: overseerPhone || 'not_configured',
          sentById: user.sub,
          messagePreview: message.slice(0, 200),
        },
      })

      const waUrl = overseerPhone
        ? `https://wa.me/${overseerPhone.replace(/\s+/g, '')}?text=${encodeURIComponent(message)}`
        : null

      return reply.send({ data: { waUrl, message } })
    },
  )
}
