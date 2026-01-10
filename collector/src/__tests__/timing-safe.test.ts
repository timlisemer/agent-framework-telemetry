import { describe, expect, test } from "bun:test";
import { timingSafeEqual } from "crypto";

// Recreate the timing-safe comparison function for testing
function timingSafeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Still perform a comparison to avoid timing leak on length check
    timingSafeEqual(Buffer.from(a), Buffer.from(a));
    return false;
  }
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

describe("Timing-Safe Comparison", () => {
  test("returns true for identical strings", () => {
    const hash = "a".repeat(64);
    expect(timingSafeCompare(hash, hash)).toBe(true);
  });

  test("returns false for different strings of same length", () => {
    const hash1 = "a".repeat(64);
    const hash2 = "b".repeat(64);
    expect(timingSafeCompare(hash1, hash2)).toBe(false);
  });

  test("returns false for strings with different lengths", () => {
    const hash1 = "a".repeat(64);
    const hash2 = "a".repeat(63);
    expect(timingSafeCompare(hash1, hash2)).toBe(false);
  });

  test("returns false for empty vs non-empty string", () => {
    expect(timingSafeCompare("", "a")).toBe(false);
  });

  test("returns true for two empty strings", () => {
    expect(timingSafeCompare("", "")).toBe(true);
  });

  test("handles SHA-256 hash format correctly", () => {
    // Typical SHA-256 hash (64 hex characters)
    const hash1 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
    const hash2 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
    expect(timingSafeCompare(hash1, hash2)).toBe(true);
  });

  test("detects single character difference in hash", () => {
    const hash1 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
    const hash2 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b856";
    expect(timingSafeCompare(hash1, hash2)).toBe(false);
  });
});
