import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { telemetryRouter } from "./routes/telemetry.js";
import { transcriptRouter } from "./routes/transcript.js";
import { healthRouter } from "./routes/health.js";
import { startCostFetcherWorker } from "./workers/cost-fetcher.js";
import { config } from "./config.js";
import pkg from "../package.json";

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
  c.json({ service: "agent-telemetry-collector", version: pkg.version })
);

console.log(`Collector starting on port ${config.PORT}`);

// Start background worker for async cost fetching
startCostFetcherWorker();

export default { port: config.PORT, fetch: app.fetch };
