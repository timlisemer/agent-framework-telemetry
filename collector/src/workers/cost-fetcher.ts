/**
 * Cost Fetcher Worker
 *
 * Background worker that fetches cost data from OpenRouter for events
 * that have generation_id but no cost yet.
 *
 * OpenRouter doesn't return cost in the immediate API response.
 * Cost must be fetched asynchronously from their generation endpoint
 * after ~2 seconds when the data is indexed.
 */

import { sql } from "../db/client.js";

interface OpenRouterGenerationData {
  id: string;
  model: string;
  total_cost: number;
  native_tokens_prompt: number;
  native_tokens_completion: number;
  native_tokens_reasoning: number;
  native_tokens_cached: number;
  cache_discount: number | null;
  latency: number;
  created_at: string;
}

interface PendingEvent {
  id: number;
  generation_id: string;
  retry_count: number;
}

// Try OPENROUTER_API_KEY first, fall back to ANTHROPIC_AUTH_TOKEN (used by agent-framework clients)
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY ?? process.env.ANTHROPIC_AUTH_TOKEN;
const API_KEY_SOURCE = process.env.OPENROUTER_API_KEY
  ? "OPENROUTER_API_KEY"
  : process.env.ANTHROPIC_AUTH_TOKEN
    ? "ANTHROPIC_AUTH_TOKEN (fallback)"
    : null;

const POLL_INTERVAL_MS = 10_000; // Check every 10 seconds
const MAX_RETRIES = 3;
const BATCH_SIZE = 50;
const REQUEST_DELAY_MS = 100; // Delay between individual API calls to avoid rate limiting

/**
 * Fetch generation data including cost from OpenRouter.
 */
async function fetchOpenRouterCost(
  generationId: string
): Promise<OpenRouterGenerationData | null> {
  if (!OPENROUTER_API_KEY) return null;

  try {
    const response = await fetch(
      `https://openrouter.ai/api/v1/generation?id=${generationId}`,
      {
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        },
      }
    );

    if (!response.ok) {
      console.error(
        `[CostFetcher] OpenRouter API error for ${generationId}: ${response.status}`
      );
      return null;
    }

    const json = await response.json();
    return json.data as OpenRouterGenerationData;
  } catch (error) {
    console.error(`[CostFetcher] Fetch error for ${generationId}:`, error);
    return null;
  }
}

/**
 * Get events that need cost fetching.
 * Only fetches events from the last 24 hours that haven't exceeded retry limit.
 */
async function getPendingEvents(): Promise<PendingEvent[]> {
  const result = await sql`
    SELECT id, generation_id, COALESCE(cost_fetch_retries, 0) as retry_count
    FROM telemetry_events
    WHERE generation_id IS NOT NULL
      AND cost IS NULL
      AND (cost_fetch_retries IS NULL OR cost_fetch_retries < ${MAX_RETRIES})
      AND created_at > NOW() - INTERVAL '24 hours'
    ORDER BY created_at ASC
    LIMIT ${BATCH_SIZE}
  `;

  return result.map((row) => ({
    id: row.id as number,
    generation_id: row.generation_id as string,
    retry_count: row.retry_count as number,
  }));
}

/**
 * Update an event with fetched cost data.
 */
async function updateEventCost(
  eventId: number,
  cost: number,
  tokens: {
    prompt?: number;
    completion?: number;
    cached?: number;
    reasoning?: number;
  }
): Promise<void> {
  await sql`
    UPDATE telemetry_events
    SET
      cost = ${cost},
      prompt_tokens = COALESCE(${tokens.prompt ?? null}, prompt_tokens),
      completion_tokens = COALESCE(${tokens.completion ?? null}, completion_tokens),
      cached_tokens = COALESCE(${tokens.cached ?? null}, cached_tokens),
      reasoning_tokens = COALESCE(${tokens.reasoning ?? null}, reasoning_tokens)
    WHERE id = ${eventId}
  `;
}

/**
 * Increment retry count for failed fetch attempts.
 */
async function incrementRetryCount(eventId: number): Promise<void> {
  await sql`
    UPDATE telemetry_events
    SET cost_fetch_retries = COALESCE(cost_fetch_retries, 0) + 1
    WHERE id = ${eventId}
  `;
}

/**
 * Process a single generation ID and return the aggregated cost.
 * Handles comma-separated IDs for multi-turn SDK sessions.
 */
async function processGenerationIds(
  generationIds: string
): Promise<{ cost: number; tokens: { prompt: number; completion: number; cached: number; reasoning: number } } | null> {
  const ids = generationIds.split(",").filter((id) => id.trim());
  let totalCost = 0;
  let totalPrompt = 0;
  let totalCompletion = 0;
  let totalCached = 0;
  let totalReasoning = 0;
  let anySuccess = false;

  for (const id of ids) {
    // Small delay between requests to avoid rate limiting
    if (anySuccess) {
      await new Promise((r) => setTimeout(r, REQUEST_DELAY_MS));
    }

    const data = await fetchOpenRouterCost(id.trim());
    if (data) {
      totalCost += data.total_cost;
      totalPrompt += data.native_tokens_prompt;
      totalCompletion += data.native_tokens_completion;
      totalCached += data.native_tokens_cached;
      totalReasoning += data.native_tokens_reasoning;
      anySuccess = true;
    }
  }

  if (!anySuccess) return null;

  return {
    cost: totalCost,
    tokens: {
      prompt: totalPrompt,
      completion: totalCompletion,
      cached: totalCached,
      reasoning: totalReasoning,
    },
  };
}

/**
 * Process all pending events and fetch their costs.
 * Returns the number of events successfully updated.
 */
export async function processPendingCosts(): Promise<number> {
  const events = await getPendingEvents();
  let processed = 0;

  for (const event of events) {
    const result = await processGenerationIds(event.generation_id);

    if (result) {
      await updateEventCost(event.id, result.cost, result.tokens);
      processed++;
    } else {
      await incrementRetryCount(event.id);
    }
  }

  return processed;
}

/**
 * Start the background cost fetcher worker.
 * Runs on an interval, checking for events that need cost data.
 */
export function startCostFetcherWorker(): void {
  if (!OPENROUTER_API_KEY) {
    console.log(
      "[CostFetcher] No API key found (tried OPENROUTER_API_KEY, ANTHROPIC_AUTH_TOKEN) - worker disabled"
    );
    return;
  }

  console.log(
    `[CostFetcher] Starting background worker (poll interval: ${POLL_INTERVAL_MS}ms, using ${API_KEY_SOURCE})`
  );

  setInterval(async () => {
    try {
      const processed = await processPendingCosts();
      if (processed > 0) {
        console.log(`[CostFetcher] Updated ${processed} events with cost data`);
      }
    } catch (error) {
      console.error("[CostFetcher] Worker error:", error);
    }
  }, POLL_INTERVAL_MS);
}
