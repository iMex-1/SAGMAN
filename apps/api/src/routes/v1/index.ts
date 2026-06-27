import { FastifyInstance } from "fastify";
import { healthRoute } from "./health";
import { authRoutes } from "./auth";
import { employeeRoutes } from "./employees";
import { settingsRoutes } from "./settings";
import { carRoutes } from "./cars";
import { appointmentRoutes } from "./appointments";
import { repairRoutes } from "./repairs";
import { partRoutes } from "./parts";
import { paymentRoutes } from "./payments";
import { portalRoutes } from "./portal";
import { dashboardRoutes } from "./dashboard";
import { searchRoutes } from "./search";
import { reportRoutes } from "./reports";
import { notificationRoutes } from "./notifications";
import { calendarRoutes } from "./calendar";

export async function v1Routes(fastify: FastifyInstance) {
  // Infrastructure
  await fastify.register(healthRoute);

  // Auth
  await fastify.register(authRoutes, { prefix: "/auth" });

  // Internal operations
  await fastify.register(employeeRoutes, { prefix: "/employees" });
  await fastify.register(settingsRoutes, { prefix: "/settings" });
  await fastify.register(carRoutes, { prefix: "/cars" });
  await fastify.register(appointmentRoutes, { prefix: "/appointments" });
  await fastify.register(repairRoutes, { prefix: "/repairs" });
  await fastify.register(partRoutes, { prefix: "/parts" });
  await fastify.register(paymentRoutes, { prefix: "/payments" });

  // Client portal
  await fastify.register(portalRoutes, { prefix: "/portal" });

  // Analytics & reporting
  await fastify.register(dashboardRoutes, { prefix: "/dashboard" });
  await fastify.register(reportRoutes, { prefix: "/reports" });
  await fastify.register(notificationRoutes, { prefix: "/notifications" });

  // Planning
  await fastify.register(calendarRoutes, { prefix: "/calendar" });

  // Search
  await fastify.register(searchRoutes, { prefix: "/search" });
}
