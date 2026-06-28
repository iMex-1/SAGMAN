import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { authorize } from '../../../hooks/authorize'
import { JwtPayload } from '../../../plugins/jwt'

export async function calendarRoutes(fastify: FastifyInstance) {
  // GET /day?date=2026-07-01 — repairs and appointments for a single day
  fastify.get(
    '/day',
    { preHandler: [authorize(['manager', 'mechanic'])] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as JwtPayload
      const { date } = request.query as { date?: string }
      const targetDate = date ? new Date(date) : new Date()
      const dayStart = new Date(
        targetDate.getFullYear(),
        targetDate.getMonth(),
        targetDate.getDate(),
      )
      const dayEnd = new Date(dayStart.getTime() + 86400000)

      const where: Record<string, unknown> = {
        status: { notIn: ['delivered', 'cancelled'] },
        OR: [
          { createdAt: { gte: dayStart, lt: dayEnd } },
          { targetCompletionDate: { gte: dayStart, lt: dayEnd } },
          {
            AND: [
              { createdAt: { lt: dayEnd } },
              { targetCompletionDate: { gte: dayStart } },
            ],
          },
        ],
      }

      if (user.role === 'mechanic') {
        where.mechanics = { some: { mechanicId: user.sub } }
      }

      const repairs = await fastify.prisma.repairJob.findMany({
        where,
        include: {
          car: { select: { id: true, matricule: true, make: true, model: true } },
          primaryMechanic: { select: { id: true, name: true } },
          mechanics: { include: { mechanic: { select: { id: true, name: true } } } },
        },
        orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      })

      const appointments = await fastify.prisma.appointment.findMany({
        where: {
          status: { in: ['confirmed', 'rescheduled'] },
          requestedAt: { gte: dayStart, lt: dayEnd },
          deletedAt: null,
        },
        include: { car: { select: { matricule: true, make: true, model: true } } },
      })

      return reply.send({ data: { date: dayStart.toISOString(), repairs, appointments } })
    },
  )

  // GET /week?startDate=2026-06-30 — repairs and appointments for a 7-day window
  fastify.get(
    '/week',
    { preHandler: [authorize(['manager', 'mechanic'])] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as JwtPayload
      const { startDate } = request.query as { startDate?: string }
      const weekStart = startDate ? new Date(startDate) : new Date()
      weekStart.setHours(0, 0, 0, 0)
      const weekEnd = new Date(weekStart.getTime() + 7 * 86400000)

      const where: Record<string, unknown> = {
        status: { notIn: ['cancelled'] },
        OR: [
          { targetCompletionDate: { gte: weekStart, lt: weekEnd } },
          {
            AND: [
              { createdAt: { lt: weekEnd } },
              { status: { notIn: ['delivered', 'cancelled'] } },
            ],
          },
        ],
      }

      if (user.role === 'mechanic') {
        where.mechanics = { some: { mechanicId: user.sub } }
      }

      const repairs = await fastify.prisma.repairJob.findMany({
        where,
        include: {
          car: { select: { id: true, matricule: true, make: true, model: true } },
          primaryMechanic: { select: { id: true, name: true } },
        },
        orderBy: { targetCompletionDate: 'asc' },
        take: 100,
      })

      const appointments = await fastify.prisma.appointment.findMany({
        where: {
          status: { in: ['confirmed', 'rescheduled'] },
          requestedAt: { gte: weekStart, lt: weekEnd },
          deletedAt: null,
        },
        orderBy: { requestedAt: 'asc' },
      })

      return reply.send({
        data: {
          weekStart: weekStart.toISOString(),
          weekEnd: weekEnd.toISOString(),
          repairs,
          appointments,
        },
      })
    },
  )

  // GET /month?year=2026&month=7 — day-by-day counts for a full month
  fastify.get(
    '/month',
    { preHandler: [authorize(['manager'])] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const now = new Date()
      const { year, month } = request.query as { year?: string; month?: string }
      const y = parseInt(year ?? String(now.getFullYear()))
      const m = parseInt(month ?? String(now.getMonth() + 1)) - 1
      const monthStart = new Date(y, m, 1)
      const monthEnd = new Date(y, m + 1, 1)
      const daysInMonth = new Date(y, m + 1, 0).getDate()

      const repairs = await fastify.prisma.repairJob.findMany({
        where: {
          status: { notIn: ['cancelled'] },
          OR: [
            { createdAt: { gte: monthStart, lt: monthEnd } },
            { targetCompletionDate: { gte: monthStart, lt: monthEnd } },
          ],
        },
        select: { createdAt: true, targetCompletionDate: true, status: true },
      })

      const appointments = await fastify.prisma.appointment.findMany({
        where: {
          status: { in: ['confirmed', 'rescheduled'] },
          requestedAt: { gte: monthStart, lt: monthEnd },
          deletedAt: null,
        },
        select: { requestedAt: true },
      })

      const days = Array.from({ length: daysInMonth }, (_, i) => {
        const dayDate = new Date(y, m, i + 1)
        const nextDay = new Date(y, m, i + 2)
        const repairCount = repairs.filter(
          r =>
            (r.createdAt >= dayDate && r.createdAt < nextDay) ||
            (r.targetCompletionDate &&
              r.targetCompletionDate >= dayDate &&
              r.targetCompletionDate < nextDay),
        ).length
        const apptCount = appointments.filter(
          a => a.requestedAt >= dayDate && a.requestedAt < nextDay,
        ).length
        return {
          date: dayDate.toISOString().split('T')[0],
          repairCount,
          appointmentCount: apptCount,
          total: repairCount + apptCount,
        }
      })

      return reply.send({ data: { year: y, month: m + 1, days } })
    },
  )
}
