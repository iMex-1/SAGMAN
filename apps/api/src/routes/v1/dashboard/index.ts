import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { authorize } from '../../../hooks/authorize'

function getDateRange(period: string): { start: Date; end: Date } {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  switch (period) {
    case 'today':
      return { start: today, end: new Date(today.getTime() + 86400000) }
    case 'week': {
      const dayOfWeek = today.getDay() || 7 // treat Sunday as 7 so Mon=1
      const monday = new Date(today)
      monday.setDate(today.getDate() - dayOfWeek + 1)
      const sunday = new Date(monday)
      sunday.setDate(monday.getDate() + 7)
      return { start: monday, end: sunday }
    }
    default: {
      // month
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)
      return { start: monthStart, end: monthEnd }
    }
  }
}

export async function dashboardRoutes(fastify: FastifyInstance) {
  // GET /overview?period=today|week|month
  fastify.get(
    '/overview',
    { preHandler: [authorize(['manager', 'overseer'])] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = request.query as { period?: string; year?: string; month?: string }
      const { start, end } = getDateRange(query.period ?? 'today')
      const now = new Date()
      const year = parseInt(query.year ?? String(now.getFullYear()))
      const month = parseInt(query.month ?? String(now.getMonth() + 1)) - 1
      const monthStart = new Date(year, month, 1)
      const monthEnd = new Date(year, month + 1, 1)

      const [
        revenueResult,
        carsReceived,
        deliveredRepairs,
        delayedRepairs,
        statusCounts,
        overdueRepairs,
        lowStockParts,
        pendingAppointments,
        urgentRepairs,
        mechanics,
        completedGroups,
        delayGroups,
        payments,
      ] = await Promise.all([
        fastify.prisma.payment.aggregate({
          _sum: { finalTotal: true },
          where: { createdAt: { gte: start, lt: end } },
        }),
        fastify.prisma.repairJob.count({
          where: { createdAt: { gte: start, lt: end } },
        }),
        fastify.prisma.repairJob.findMany({
          where: { status: 'delivered', actualCompletionDate: { gte: start, lt: end } },
          select: { actualCompletionDate: true, targetCompletionDate: true, createdAt: true },
        }),
        fastify.prisma.delayReport.count({
          where: { createdAt: { gte: start, lt: end } },
        }),
        fastify.prisma.repairJob.groupBy({
          by: ['status'],
          where: { status: { notIn: ['delivered', 'cancelled'] } },
          _count: true,
        }),
        fastify.prisma.repairJob.findMany({
          where: {
            status: { notIn: ['complete', 'delivered', 'cancelled'] },
            targetCompletionDate: { lt: now },
            delayReports: { none: {} },
          },
          include: {
            car: { select: { matricule: true, make: true, model: true } },
            primaryMechanic: { select: { name: true } },
          },
          take: 10,
        }),
        fastify.prisma.$queryRaw<
          Array<{ id: string; name: string; quantity: number; min_threshold: number }>
        >`
          SELECT id, name, quantity, min_threshold FROM parts
          WHERE quantity <= min_threshold AND deleted_at IS NULL
          LIMIT 10
        `,
        fastify.prisma.appointment.count({
          where: { status: 'pending', deletedAt: null },
        }),
        fastify.prisma.repairJob.findMany({
          where: {
            priority: { in: ['high', 'emergency'] },
            status: { notIn: ['complete', 'delivered', 'cancelled'] },
          },
          include: { car: { select: { matricule: true, make: true, model: true } } },
          orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
          take: 10,
        }),
        fastify.prisma.user.findMany({
          where: { role: 'mechanic', status: 'active' },
          select: { id: true, name: true },
        }),
        fastify.prisma.repairMechanic.groupBy({
          by: ['mechanicId'],
          where: {
            repair: {
              status: 'delivered',
              actualCompletionDate: { gte: monthStart, lt: monthEnd },
            },
          },
          _count: { mechanicId: true },
        }),
        fastify.prisma.delayReport.groupBy({
          by: ['reportedById'],
          where: { createdAt: { gte: monthStart, lt: monthEnd } },
          _count: { reportedById: true },
        }),
        fastify.prisma.payment.findMany({
          where: {
            createdAt: {
              gte: new Date(year, month, 1),
              lt: new Date(year, month + 1, 1),
            },
          },
          select: { finalTotal: true, createdAt: true },
        }),
      ])

      const carsDelivered = deliveredRepairs.length
      const onTime = deliveredRepairs.filter(
        (r) =>
          r.targetCompletionDate &&
          r.actualCompletionDate &&
          r.actualCompletionDate <= r.targetCompletionDate,
      ).length
      const onTimeRate =
        deliveredRepairs.length > 0
          ? Math.round((onTime / deliveredRepairs.length) * 100)
          : 100

      const avgDuration =
        deliveredRepairs.length > 0
          ? deliveredRepairs.reduce((sum, r) => {
              const days = r.actualCompletionDate
                ? (r.actualCompletionDate.getTime() - r.createdAt.getTime()) / 86400000
                : 0
              return sum + days
            }, 0) / deliveredRepairs.length
          : 0

      const mechanicPerformance = mechanics.map((mechanic) => {
        const completed = completedGroups.find(
          (group) => group.mechanicId === mechanic.id,
        )?._count.mechanicId ?? 0
        const delays = delayGroups.find(
          (group) => group.reportedById === mechanic.id,
        )?._count.reportedById ?? 0
        return { mechanic, carsCompleted: completed, delays }
      })

      const dailyRevenue: Record<number, number> = {}
      payments.forEach((p) => {
        const day = p.createdAt.getDate()
        dailyRevenue[day] = (dailyRevenue[day] ?? 0) + p.finalTotal.toNumber()
      })
      const daysInMonth = new Date(year, month + 1, 0).getDate()
      const revenueChart = Array.from({ length: daysInMonth }, (_, i) => ({
        day: i + 1,
        revenue: Math.round((dailyRevenue[i + 1] ?? 0) * 100) / 100,
      }))

      return reply.send({
        data: {
          summary: {
            totalRevenue: revenueResult._sum.finalTotal?.toNumber() ?? 0,
            carsReceived,
            carsDelivered,
            avgRepairDurationDays: Math.round(avgDuration * 10) / 10,
            onTimeRate,
            delayedRepairs,
            period: query.period ?? 'today',
          },
          live: {
            activeByStatus: Object.fromEntries(
              statusCounts.map((s) => [s.status, s._count]),
            ),
            overdueRepairs,
            overdueCount: overdueRepairs.length,
            lowStockParts: lowStockParts.map((p) => ({
              ...p,
              minThreshold: p.min_threshold,
            })),
            pendingAppointments,
            urgentRepairs,
          },
          mechanicPerformance,
          revenueChart,
        },
      })
    },
  )

  // GET /summary?period=today|week|month
  fastify.get(
    '/summary',
    { preHandler: [authorize(['manager', 'overseer'])] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = request.query as { period?: string }
      const { start, end } = getDateRange(query.period ?? 'today')

      const [revenueResult, carsReceived, deliveredRepairs, delayedRepairs] = await Promise.all([
        fastify.prisma.payment.aggregate({
          _sum: { finalTotal: true },
          where: { createdAt: { gte: start, lt: end } },
        }),
        fastify.prisma.repairJob.count({
          where: { createdAt: { gte: start, lt: end } },
        }),
        fastify.prisma.repairJob.findMany({
          where: { status: 'delivered', actualCompletionDate: { gte: start, lt: end } },
          select: { actualCompletionDate: true, targetCompletionDate: true, createdAt: true },
        }),
        fastify.prisma.delayReport.count({
          where: { createdAt: { gte: start, lt: end } },
        }),
      ])

      const carsDelivered = deliveredRepairs.length

      const onTime = deliveredRepairs.filter(
        (r) =>
          r.targetCompletionDate &&
          r.actualCompletionDate &&
          r.actualCompletionDate <= r.targetCompletionDate,
      ).length
      const onTimeRate =
        deliveredRepairs.length > 0
          ? Math.round((onTime / deliveredRepairs.length) * 100)
          : 100

      const avgDuration =
        deliveredRepairs.length > 0
          ? deliveredRepairs.reduce((sum, r) => {
              const days = r.actualCompletionDate
                ? (r.actualCompletionDate.getTime() - r.createdAt.getTime()) / 86400000
                : 0
              return sum + days
            }, 0) / deliveredRepairs.length
          : 0

      return reply.send({
        data: {
          totalRevenue: revenueResult._sum.finalTotal?.toNumber() ?? 0,
          carsReceived,
          carsDelivered,
          avgRepairDurationDays: Math.round(avgDuration * 10) / 10,
          onTimeRate,
          delayedRepairs,
          period: query.period ?? 'today',
        },
      })
    },
  )

  // GET /live — real-time state widgets (manager only)
  fastify.get(
    '/live',
    { preHandler: [authorize(['manager'])] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const now = new Date()

      const statusCounts = await fastify.prisma.repairJob.groupBy({
        by: ['status'],
        where: { status: { notIn: ['delivered', 'cancelled'] } },
        _count: true,
      })

      const overdueRepairs = await fastify.prisma.repairJob.findMany({
        where: {
          status: { notIn: ['complete', 'delivered', 'cancelled'] },
          targetCompletionDate: { lt: now },
          delayReports: { none: {} },
        },
        include: {
          car: { select: { matricule: true, make: true, model: true } },
          primaryMechanic: { select: { name: true } },
        },
        take: 10,
      })

      const lowStockParts = await fastify.prisma.$queryRaw<
        Array<{ id: string; name: string; quantity: number; min_threshold: number }>
      >`
        SELECT id, name, quantity, min_threshold FROM parts
        WHERE quantity <= min_threshold AND deleted_at IS NULL
        LIMIT 10
      `

      const pendingAppointments = await fastify.prisma.appointment.count({
        where: { status: 'pending', deletedAt: null },
      })

      const urgentRepairs = await fastify.prisma.repairJob.findMany({
        where: {
          priority: { in: ['high', 'emergency'] },
          status: { notIn: ['complete', 'delivered', 'cancelled'] },
        },
        include: { car: { select: { matricule: true, make: true, model: true } } },
        orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
        take: 10,
      })

      return reply.send({
        data: {
          activeByStatus: Object.fromEntries(statusCounts.map(s => [s.status, s._count])),
          overdueRepairs,
          overdueCount: overdueRepairs.length,
          lowStockParts: lowStockParts.map(p => ({ ...p, minThreshold: p.min_threshold })),
          pendingAppointments,
          urgentRepairs,
        },
      })
    },
  )

  // GET /mechanic-performance?year=&month=
  fastify.get(
    '/mechanic-performance',
    { preHandler: [authorize(['manager', 'overseer'])] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = request.query as { year?: string; month?: string }
      const now = new Date()
      const year = parseInt(query.year ?? String(now.getFullYear()))
      const month = parseInt(query.month ?? String(now.getMonth() + 1)) - 1
      const monthStart = new Date(year, month, 1)
      const monthEnd = new Date(year, month + 1, 1)

      const mechanics = await fastify.prisma.user.findMany({
        where: { role: 'mechanic', status: 'active' },
        select: { id: true, name: true },
      })

      const performance = await Promise.all(
        mechanics.map(async mechanic => {
          const completed = await fastify.prisma.repairJob.count({
            where: {
              status: 'delivered',
              actualCompletionDate: { gte: monthStart, lt: monthEnd },
              mechanics: { some: { mechanicId: mechanic.id } },
            },
          })
          const delays = await fastify.prisma.delayReport.count({
            where: {
              reportedById: mechanic.id,
              createdAt: { gte: monthStart, lt: monthEnd },
            },
          })
          return { mechanic, carsCompleted: completed, delays }
        }),
      )

      return reply.send({ data: performance })
    },
  )

  // GET /revenue-chart?year=&month= — daily revenue for the month
  fastify.get(
    '/revenue-chart',
    { preHandler: [authorize(['manager', 'overseer'])] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = request.query as { year?: string; month?: string }
      const now = new Date()
      const year = parseInt(query.year ?? String(now.getFullYear()))
      const month = parseInt(query.month ?? String(now.getMonth() + 1)) - 1
      const daysInMonth = new Date(year, month + 1, 0).getDate()

      const payments = await fastify.prisma.payment.findMany({
        where: {
          createdAt: {
            gte: new Date(year, month, 1),
            lt: new Date(year, month + 1, 1),
          },
        },
        select: { finalTotal: true, createdAt: true },
      })

      const dailyRevenue: Record<number, number> = {}
      payments.forEach(p => {
        const day = p.createdAt.getDate()
        dailyRevenue[day] = (dailyRevenue[day] ?? 0) + p.finalTotal.toNumber()
      })

      const data = Array.from({ length: daysInMonth }, (_, i) => ({
        day: i + 1,
        revenue: Math.round((dailyRevenue[i + 1] ?? 0) * 100) / 100,
      }))

      return reply.send({ data })
    },
  )
}
