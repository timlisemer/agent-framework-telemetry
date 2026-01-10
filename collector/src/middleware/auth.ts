import { createMiddleware } from "hono/factory";
import { timingSafeEqual } from "crypto";
import { getApiKeyByHash, updateApiKeyLastUsed } from "../db/queries.js";

async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Still perform a comparison to avoid timing leak on length check
    timingSafeEqual(Buffer.from(a), Buffer.from(a));
    return false;
  }
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export const authMiddleware = createMiddleware(async (c, next) => {
  const apiKey = c.req.header("X-API-Key");

  if (!apiKey) {
    return c.json({ error: "Missing X-API-Key header" }, 401);
  }

  const keyHash = await hashApiKey(apiKey);
  const result = await getApiKeyByHash(keyHash);

  if (!result || !timingSafeCompare(result.key_hash, keyHash)) {
    return c.json({ error: "Invalid API key" }, 403);
  }

  // Update last_used_at in background (non-blocking)
  updateApiKeyLastUsed(keyHash);

  await next();
});
