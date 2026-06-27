import Fastify, { FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { prismaPlugin } from "./plugins/prisma";
import { jwtPlugin } from "./plugins/jwt";
import { corsPlugin } from "./plugins/cors";
import { rateLimitPlugin } from "./plugins/rate-limit";
import { v1Routes } from "./routes/v1";

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: process.env.NODE_ENV === "production" ? "info" : "debug",
      transport:
        process.env.NODE_ENV !== "production"
          ? { target: "pino-pretty", options: { colorize: true } }
          : undefined,
    },
  });

  // Register plugins
  await app.register(corsPlugin);
  await app.register(rateLimitPlugin);
  await app.register(prismaPlugin);
  await app.register(jwtPlugin);

  // Register routes
  await app.register(v1Routes, { prefix: "/api/v1" });

  // Global error handler — handles Zod validation errors and all AppErrors
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(422).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request data",
          statusCode: 422,
          details: error.errors,
        },
      });
    }

    const err = error as any;
    const statusCode: number = err.statusCode ?? 500;
    const code: string = err.code ?? "INTERNAL_SERVER_ERROR";

    app.log.error(
      { err: error, url: request.url },
      err.message ?? "Unknown error",
    );

    return reply.status(statusCode).send({
      error: {
        code,
        message:
          statusCode === 500
            ? "An unexpected error occurred"
            : (err.message ?? "An error occurred"),
        statusCode,
      },
    });
  });

  return app;
}
