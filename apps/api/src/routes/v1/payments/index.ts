import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { RegisterPaymentSchema } from '@sagman/shared'
import { authorize } from '../../../hooks/authorize'
import { Errors } from '../../../utils/errors'
import { JwtPayload } from '../../../plugins/jwt'
import { InvoiceService } from '../../../services/invoice.service'

export async function paymentRoutes(fastify: FastifyInstance) {
  // ── POST / — Register payment (BR-006, BR-007) ─────────────────────────────
  fastify.post(
    '/',
    { preHandler: authorize(['manager']) },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as JwtPayload
      const body = RegisterPaymentSchema.parse(request.body)

      const repair = await fastify.prisma.repairJob.findUnique({
        where: { id: body.repairId },
        include: {
          car: { include: { client: true } },
          primaryMechanic: true,
          payment: true,
        },
      })

      if (!repair) throw Errors.NotFound('Repair', body.repairId)

      // BR-006: repair must be complete before payment
      if (repair.status !== 'complete') {
        throw Errors.BusinessRule(
          'STATUS_NOT_COMPLETE',
          'Payment can only be registered when repair is complete',
        )
      }

      // Cannot pay twice
      if (repair.payment) {
        throw Errors.Conflict('Payment already registered for this repair')
      }

      const invoiceNumber = await InvoiceService.generateNumber(fastify.prisma)
      const changeDue = body.amountReceived - body.amountBilled

      const payment = await fastify.prisma.payment.create({
        data: {
          repairId: body.repairId,
          amountBilled: body.amountBilled,
          partsTotal: repair.partsTotal.toNumber(),
          laborTotal: repair.laborTotal.toNumber(),
          discountAmount: body.discountAmount ?? 0,
          finalTotal: body.amountBilled,
          amountReceived: body.amountReceived,
          changeDue,
          method: 'cash',
          paidByName: body.paidByName,
          receivedById: user.sub,
          invoiceNumber,
          notes: body.notes,
        },
        include: {
          receivedBy: { select: { id: true, name: true } },
        },
      })

      return reply.status(201).send({ data: payment })
    },
  )

  // ── GET /invoice/:repairId — Full invoice data for rendering ───────────────
  // NOTE: This route must be declared before GET /:id to avoid path conflicts.
  fastify.get(
    '/invoice/:repairId',
    { preHandler: authorize(['manager']) },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { repairId } = request.params as { repairId: string }

      const repair = await fastify.prisma.repairJob.findUnique({
        where: { id: repairId },
        include: {
          car: { include: { client: true } },
          primaryMechanic: { select: { id: true, name: true } },
          mechanics: { include: { mechanic: { select: { id: true, name: true } } } },
          createdBy: { select: { id: true, name: true } },
          parts: {
            include: {
              part: { select: { id: true, name: true, reference: true } },
            },
          },
          laborItems: true,
          payment: true,
        },
      })

      if (!repair) throw Errors.NotFound('Repair', repairId)
      if (!repair.payment) throw Errors.BadRequest('No payment registered for this repair')

      // Fetch garage settings for invoice header
      const settings = await fastify.prisma.systemSettings.findMany()
      const settingsMap = settings.reduce((acc: Record<string, string>, s) => {
        acc[s.key] = s.value
        return acc
      }, {})

      return reply.send({
        data: {
          invoice: repair.payment,
          repair: {
            id: repair.id,
            description: repair.description,
            status: repair.status,
          },
          car: repair.car,
          client: repair.car.client,
          laborItems: repair.laborItems,
          parts: repair.parts,
          mechanics: repair.mechanics.map((m) => m.mechanic),
          createdBy: repair.createdBy,
          settings: {
            garageName: settingsMap['garage_name'] ?? 'Garage Sagman',
            garageAddress: settingsMap['garage_address'] ?? '',
            garagePhone: settingsMap['garage_phone'] ?? '',
            currencyLabel: settingsMap['currency_label'] ?? 'DH',
          },
        },
      })
    },
  )

  // ── GET /repair/:repairId — Get payment for a specific repair ──────────────
  fastify.get(
    '/repair/:repairId',
    { preHandler: authorize(['manager', 'mechanic']) },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { repairId } = request.params as { repairId: string }

      const payment = await fastify.prisma.payment.findUnique({
        where: { repairId },
        include: {
          receivedBy: { select: { id: true, name: true } },
          repair: {
            include: {
              car: { include: { client: true } },
              primaryMechanic: { select: { id: true, name: true } },
              laborItems: true,
              parts: {
                include: {
                  part: { select: { id: true, name: true, reference: true } },
                },
              },
            },
          },
        },
      })

      if (!payment) throw Errors.NotFound('Payment for repair', repairId)

      return reply.send({ data: payment })
    },
  )

  // ── GET /:id — Payment detail ──────────────────────────────────────────────
  fastify.get(
    '/:id',
    { preHandler: authorize(['manager']) },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }

      const payment = await fastify.prisma.payment.findUnique({
        where: { id },
        include: {
          receivedBy: { select: { id: true, name: true } },
          repair: {
            include: {
              car: { include: { client: true } },
              primaryMechanic: { select: { id: true, name: true } },
              laborItems: true,
              parts: {
                include: {
                  part: { select: { id: true, name: true, reference: true } },
                },
              },
            },
          },
        },
      })

      if (!payment) throw Errors.NotFound('Payment', id)

      return reply.send({ data: payment })
    },
  )
}
