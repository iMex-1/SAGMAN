import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { authorize } from "../../../hooks/authorize";
import { getPaginationParams, paginate } from "../../../utils/pagination";

export async function notificationRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/",
    { preHandler: [authorize(["manager"])] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = request.query as {
        page?: string;
        limit?: string;
        type?: string;
      };
      const { page, limit, skip } = getPaginationParams({
        page: query.page ? parseInt(query.page) : 1,
        limit: query.limit ? parseInt(query.limit) : 20,
      });

      const where: Record<string, unknown> = {};
      if (query.type) where.type = query.type;

      const [notifications, total] = await fastify.prisma.$transaction([
        fastify.prisma.notificationLog.findMany({
          where,
          skip,
          take: limit,
          orderBy: { sentAt: "desc" },
          include: { sentBy: { select: { id: true, name: true } } },
        }),
        fastify.prisma.notificationLog.count({ where }),
      ]);

      return reply.send(paginate(notifications, total, page, limit));
    },
  );
}
