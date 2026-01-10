import { z } from "zod";

const ConfigSchema = z.object({
  // Server
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),

  // Database (validated separately in db/client.ts for early fail)
  DATABASE_URL: z.string().optional(),

  // Cost Fetcher
  OPENROUTER_API_KEY: z.string().optional(),
  ANTHROPIC_AUTH_TOKEN: z.string().optional(),
});

const parsed = ConfigSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Configuration error:", parsed.error.format());
  process.exit(1);
}

export const config = parsed.data;
