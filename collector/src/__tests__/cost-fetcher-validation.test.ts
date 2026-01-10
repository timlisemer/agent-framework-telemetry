import { describe, expect, test } from "bun:test";
import { z } from "zod";

// Recreate the OpenRouter schema for testing
const OpenRouterGenerationSchema = z.object({
  id: z.string(),
  model: z.string(),
  total_cost: z.number(),
  native_tokens_prompt: z.number().default(0),
  native_tokens_completion: z.number().default(0),
  native_tokens_reasoning: z.number().default(0),
  native_tokens_cached: z.number().default(0),
  cache_discount: z.number().nullable(),
  latency: z.number(),
  created_at: z.string(),
});

const OpenRouterResponseSchema = z.object({
  data: OpenRouterGenerationSchema,
});

describe("OpenRouter Response Validation", () => {
  describe("Valid Responses", () => {
    test("accepts valid response with all fields", () => {
      const response = {
        data: {
          id: "gen_123",
          model: "anthropic/claude-3-haiku",
          total_cost: 0.00025,
          native_tokens_prompt: 100,
          native_tokens_completion: 50,
          native_tokens_reasoning: 0,
          native_tokens_cached: 25,
          cache_discount: 0.5,
          latency: 1234,
          created_at: "2024-01-01T00:00:00Z",
        },
      };
      const result = OpenRouterResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    test("accepts response with null cache_discount", () => {
      const response = {
        data: {
          id: "gen_123",
          model: "anthropic/claude-3-haiku",
          total_cost: 0.00025,
          native_tokens_prompt: 100,
          native_tokens_completion: 50,
          native_tokens_reasoning: 0,
          native_tokens_cached: 0,
          cache_discount: null,
          latency: 1234,
          created_at: "2024-01-01T00:00:00Z",
        },
      };
      const result = OpenRouterResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    test("uses default values for optional token fields", () => {
      const response = {
        data: {
          id: "gen_123",
          model: "anthropic/claude-3-haiku",
          total_cost: 0.00025,
          cache_discount: null,
          latency: 1234,
          created_at: "2024-01-01T00:00:00Z",
        },
      };
      const result = OpenRouterResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.data.native_tokens_prompt).toBe(0);
        expect(result.data.data.native_tokens_completion).toBe(0);
        expect(result.data.data.native_tokens_reasoning).toBe(0);
        expect(result.data.data.native_tokens_cached).toBe(0);
      }
    });
  });

  describe("Invalid Responses", () => {
    test("rejects response without data wrapper", () => {
      const response = {
        id: "gen_123",
        model: "anthropic/claude-3-haiku",
        total_cost: 0.00025,
      };
      const result = OpenRouterResponseSchema.safeParse(response);
      expect(result.success).toBe(false);
    });

    test("rejects response with missing required field (id)", () => {
      const response = {
        data: {
          model: "anthropic/claude-3-haiku",
          total_cost: 0.00025,
          cache_discount: null,
          latency: 1234,
          created_at: "2024-01-01T00:00:00Z",
        },
      };
      const result = OpenRouterResponseSchema.safeParse(response);
      expect(result.success).toBe(false);
    });

    test("rejects response with missing required field (total_cost)", () => {
      const response = {
        data: {
          id: "gen_123",
          model: "anthropic/claude-3-haiku",
          cache_discount: null,
          latency: 1234,
          created_at: "2024-01-01T00:00:00Z",
        },
      };
      const result = OpenRouterResponseSchema.safeParse(response);
      expect(result.success).toBe(false);
    });

    test("rejects response with wrong type for total_cost", () => {
      const response = {
        data: {
          id: "gen_123",
          model: "anthropic/claude-3-haiku",
          total_cost: "0.00025", // string instead of number
          cache_discount: null,
          latency: 1234,
          created_at: "2024-01-01T00:00:00Z",
        },
      };
      const result = OpenRouterResponseSchema.safeParse(response);
      expect(result.success).toBe(false);
    });

    test("rejects null response", () => {
      const result = OpenRouterResponseSchema.safeParse(null);
      expect(result.success).toBe(false);
    });

    test("rejects empty object", () => {
      const result = OpenRouterResponseSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });
});
