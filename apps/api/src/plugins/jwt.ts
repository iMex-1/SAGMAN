import fp from "fastify-plugin";
import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fastifyJwt from "@fastify/jwt";
import fastifyCookie from "@fastify/cookie";

export interface JwtPayload {
  sub: string; // user id
  role: string; // user role
  type: "access" | "refresh" | "client";
  iat?: number;
  exp?: number;
}

// Augment @fastify/jwt to type request.user correctly
declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: JwtPayload;
    user: JwtPayload;
  }
}

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (
      request: FastifyRequest,
      reply: FastifyReply,
    ) => Promise<void>;
    authenticateClient: (
      request: FastifyRequest,
      reply: FastifyReply,
    ) => Promise<void>;
  }
}

async function jwtPlugin(fastify: FastifyInstance) {
  await fastify.register(fastifyCookie);

  await fastify.register(fastifyJwt, {
    secret: process.env.JWT_SECRET!,
    sign: {
      expiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? "8h",
    },
  });

  // Internal user authentication
  fastify.decorate(
    "authenticate",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await request.jwtVerify();
        const payload = request.user as JwtPayload;
        if (payload.type !== "access") {
          return reply.status(401).send({
            error: {
              code: "INVALID_TOKEN_TYPE",
              message: "Access token required",
              statusCode: 401,
            },
          });
        }
      } catch (err) {
        reply.status(401).send({
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication required",
            statusCode: 401,
          },
        });
      }
    },
  );

  // Client portal authentication
  fastify.decorate(
    "authenticateClient",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await request.jwtVerify();
        const payload = request.user as JwtPayload;
        if (payload.type !== "client") {
          return reply.status(401).send({
            error: {
              code: "INVALID_TOKEN_TYPE",
              message: "Client token required",
              statusCode: 401,
            },
          });
        }
      } catch (err) {
        reply.status(401).send({
          error: {
            code: "UNAUTHORIZED",
            message: "Client authentication required",
            statusCode: 401,
          },
        });
      }
    },
  );
}

export default fp(jwtPlugin, { name: "jwt" });
export { jwtPlugin };
