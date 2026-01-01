import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { telemetryRouter } from "./routes/telemetry.js";
import { transcriptRouter } from "./routes/transcript.js";
import { healthRouter } from "./routes/health.js";

const app = new Hono();

app.use("*", logger());
app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST"],
    allowHeaders: ["Content-Type", "X-API-Key"],
  })
);

app.route("/api/v1/telemetry", telemetryRouter);
app.route("/api/v1/transcript", transcriptRouter);
app.route("/api/v1/health", healthRouter);

app.get("/", (c) =>
  c.json({ service: "agent-telemetry-collector", version: "1.0.0" })
);

const port = parseInt(process.env.PORT || "3001");
console.log(`Collector starting on port ${port}`);

export default { port, fetch: app.fetch };
