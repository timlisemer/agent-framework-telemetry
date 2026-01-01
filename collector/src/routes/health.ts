import { Hono } from "hono";
import { checkConnection } from "../db/client.js";

const healthRouter = new Hono();

healthRouter.get("/", async (c) => {
  const dbHealthy = await checkConnection();

  if (!dbHealthy) {
    return c.json({ status: "unhealthy", database: "disconnected" }, 503);
  }

  return c.json({ status: "healthy", database: "connected" });
});

export { healthRouter };
