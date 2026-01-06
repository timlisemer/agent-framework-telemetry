import { createMiddleware } from "hono/factory";
import { validateApiKey } from "../db/queries.js";

async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const authMiddleware = createMiddleware<{
  Variables: { apiKeyId: number };
}>(async (c, next) => {
  const apiKey = c.req.header("X-API-Key");

  if (!apiKey) {
    return c.json({ error: "Missing X-API-Key header" }, 401);
  }

  const keyHash = await hashApiKey(apiKey);
  const result = await validateApiKey(keyHash);

  if (!result) {
    return c.json({ error: "Invalid API key" }, 403);
  }

  c.set("apiKeyId", result.id);
  await next();
});
