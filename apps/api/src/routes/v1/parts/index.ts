import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import {
  CreatePartSchema,
  UpdatePartSchema,
  AddStockSchema,
  AdjustStockSchema,
} from '@sagman/shared'
import { authorize } from '../../../hooks/authorize'
import { Errors } from '../../../utils/errors'
import { getPaginationParams, paginate } from '../../../utils/pagination'
import { JwtPayload } from '../../../plugins/jwt'

export async function partRoutes(fastify: FastifyInstance) {
  // ── GET / — List parts catalog ─────────────────────────────────────────────
  fastify.get(
    '/',
    { preHandler: authorize(['manager', 'mechanic']) },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = request.query as {
        q?: string
        category?: string
        lowStock?: string
        page?: string
        limit?: string
      }

      const { page, limit, skip } = getPaginationParams({
        page: query.page ? parseInt(query.page) : 1,
        limit: query.limit ? parseInt(query.limit) : 20,
      })

      const where: any = { deletedAt: null }

      if (query.q) {
        where.OR = [
          { name: { contains: query.q, mode: 'insensitive' } },
          { reference: { contains: query.q, mode: 'insensitive' } },
        ]
      }

      if (query.category) {
        where.category = query.category
      }

      // For lowStock, Prisma doesn't support column-column comparisons in where,
      // so we use $queryRaw to get the matching IDs first.
      if (query.lowStock === 'true') {
        const lowStockParts = await fastify.prisma.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM parts WHERE quantity <= min_threshold AND deleted_at IS NULL
        `
        where.id = { in: lowStockParts.map((p) => p.id) }
      }

      const [parts, total] = await fastify.prisma.$transaction([
        fastify.prisma.part.findMany({
          where,
          skip,
          take: limit,
          orderBy: { name: 'asc' },
        }),
        fastify.prisma.part.count({ where }),
      ])

      const partsWithLowStock = parts.map((p) => ({
        ...p,
        unitCost: p.unitCost.toNumber(),
        isLowStock: p.quantity <= p.minThreshold,
      }))

      return reply.send(paginate(partsWithLowStock, total, page, limit))
    },
  )

  // ── POST / — Add part to catalog ───────────────────────────────────────────
  fastify.post(
    '/',
    { preHandler: authorize(['manager']) },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = CreatePartSchema.parse(request.body)

      const part = await fastify.prisma.part.create({
        data: {
          name: body.name,
          reference: body.reference,
          category: body.category as any,
          compatibleModels: body.compatibleModels,
          unitCost: body.unitCost,
          quantity: body.quantity ?? 0,
          minThreshold: body.minThreshold ?? 0,
          supplier: body.supplier,
        },
      })

      return reply.status(201).send({
        data: {
          ...part,
          unitCost: part.unitCost.toNumber(),
          isLowStock: part.quantity <= part.minThreshold,
        },
      })
    },
  )

  // ── GET /:id — Part detail + recent transactions ───────────────────────────
  fastify.get(
    '/:id',
    { preHandler: authorize(['manager', 'mechanic']) },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }

      const part = await fastify.prisma.part.findUnique({
        where: { id },
        include: {
          stockTransactions: {
            orderBy: { createdAt: 'desc' },
            take: 20,
            include: {
              doneBy: { select: { id: true, name: true } },
            },
          },
        },
      })

      if (!part || part.deletedAt !== null) throw Errors.NotFound('Part', id)

      return reply.send({
        data: {
          ...part,
          unitCost: part.unitCost.toNumber(),
          isLowStock: part.quantity <= part.minThreshold,
        },
      })
    },
  )

  // ── PATCH /:id — Update part ───────────────────────────────────────────────
  fastify.patch(
    '/:id',
    { preHandler: authorize(['manager']) },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      const body = UpdatePartSchema.parse(request.body)

      const existing = await fastify.prisma.part.findUnique({ where: { id } })
      if (!existing || existing.deletedAt !== null) throw Errors.NotFound('Part', id)

      // Quantity can only be changed via stock endpoints
      const { quantity: _quantity, ...updateFields } = body

      const updated = await fastify.prisma.part.update({
        where: { id },
        data: {
          ...(updateFields.name !== undefined && { name: updateFields.name }),
          ...(updateFields.reference !== undefined && { reference: updateFields.reference }),
          ...(updateFields.category !== undefined && { category: updateFields.category as any }),
          ...(updateFields.compatibleModels !== undefined && {
            compatibleModels: updateFields.compatibleModels,
          }),
          ...(updateFields.unitCost !== undefined && { unitCost: updateFields.unitCost }),
          ...(updateFields.minThreshold !== undefined && {
            minThreshold: updateFields.minThreshold,
          }),
          ...(updateFields.supplier !== undefined && { supplier: updateFields.supplier }),
        },
      })

      return reply.send({
        data: {
          ...updated,
          unitCost: updated.unitCost.toNumber(),
          isLowStock: updated.quantity <= updated.minThreshold,
        },
      })
    },
  )

  // ── DELETE /:id — Soft delete ──────────────────────────────────────────────
  fastify.delete(
    '/:id',
    { preHandler: authorize(['manager']) },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }

      const part = await fastify.prisma.part.findUnique({
        where: { id },
        include: { _count: { select: { repairParts: true } } },
      })

      if (!part || part.deletedAt !== null) throw Errors.NotFound('Part', id)

      // Block deletion if part has been used in any repair
      if (part._count.repairParts > 0) {
        throw Errors.BusinessRule(
          'PART_IN_USE',
          'Cannot delete a part that has been used in repairs. Archive it instead.',
        )
      }

      await fastify.prisma.part.update({
        where: { id },
        data: { deletedAt: new Date() },
      })

      return reply.send({ data: { message: 'Part deleted successfully' } })
    },
  )

  // ── POST /:id/stock — Add received stock ───────────────────────────────────
  fastify.post(
    '/:id/stock',
    { preHandler: authorize(['manager']) },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      const user = request.user as JwtPayload
      const body = AddStockSchema.parse(request.body)

      const part = await fastify.prisma.part.findUnique({ where: { id } })
      if (!part || part.deletedAt !== null) throw Errors.NotFound('Part', id)

      const newQuantity = part.quantity + body.quantity

      const [updatedPart] = await fastify.prisma.$transaction([
        fastify.prisma.part.update({
          where: { id },
          data: { quantity: { increment: body.quantity } },
        }),
        fastify.prisma.stockTransaction.create({
          data: {
            partId: id,
            type: 'received',
            quantityChange: body.quantity,
            quantityAfter: newQuantity,
            doneById: user.sub,
            note: body.note,
          },
        }),
      ])

      return reply.send({
        data: {
          ...updatedPart,
          unitCost: updatedPart.unitCost.toNumber(),
          isLowStock: updatedPart.quantity <= updatedPart.minThreshold,
        },
      })
    },
  )

  // ── POST /:id/adjust — Manual stock adjustment ─────────────────────────────
  fastify.post(
    '/:id/adjust',
    { preHandler: authorize(['manager']) },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      const user = request.user as JwtPayload
      const body = AdjustStockSchema.parse(request.body)

      const part = await fastify.prisma.part.findUnique({ where: { id } })
      if (!part || part.deletedAt !== null) throw Errors.NotFound('Part', id)

      const newQuantity = part.quantity + body.quantityChange

      // BR-017: quantity must not go below 0
      if (newQuantity < 0) {
        throw Errors.BusinessRule(
          'INSUFFICIENT_STOCK',
          `Adjustment would result in negative stock (current: ${part.quantity}, change: ${body.quantityChange})`,
        )
      }

      const [updatedPart] = await fastify.prisma.$transaction([
        fastify.prisma.part.update({
          where: { id },
          data: { quantity: { increment: body.quantityChange } },
        }),
        fastify.prisma.stockTransaction.create({
          data: {
            partId: id,
            type: 'adjustment',
            quantityChange: body.quantityChange,
            quantityAfter: newQuantity,
            doneById: user.sub,
            note: body.note,
          },
        }),
      ])

      return reply.send({
        data: {
          ...updatedPart,
          unitCost: updatedPart.unitCost.toNumber(),
          isLowStock: updatedPart.quantity <= updatedPart.minThreshold,
        },
      })
    },
  )

  // ── GET /:id/transactions — Transaction history ────────────────────────────
  fastify.get(
    '/:id/transactions',
    { preHandler: authorize(['manager', 'mechanic']) },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      const query = request.query as { page?: string; limit?: string }

      const part = await fastify.prisma.part.findUnique({ where: { id } })
      if (!part || part.deletedAt !== null) throw Errors.NotFound('Part', id)

      const { page, limit, skip } = getPaginationParams({
        page: query.page ? parseInt(query.page) : 1,
        limit: query.limit ? parseInt(query.limit) : 20,
      })

      const [transactions, total] = await fastify.prisma.$transaction([
        fastify.prisma.stockTransaction.findMany({
          where: { partId: id },
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            doneBy: { select: { id: true, name: true } },
            repair: {
              select: { id: true, status: true },
            },
          },
        }),
        fastify.prisma.stockTransaction.count({ where: { partId: id } }),
      ])

      return reply.send(paginate(transactions, total, page, limit))
    },
  )
}
