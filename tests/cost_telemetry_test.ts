import { estimateProviderCost } from "../src/providers/openai_compatible.ts";
import type { ProviderConfig } from "../src/providers/contracts.ts";

function assert(condition: unknown, message = "assertion failed"): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEquals<T>(actual: T, expected: T): void {
  if (!Object.is(actual, expected)) {
    throw new Error(`expected ${String(expected)}, got ${String(actual)}`);
  }
}

const deepSeekFlash: ProviderConfig = {
  id: "deepseek",
  name: "DeepSeek 官方",
  protocol: "openai",
  apiKey: "test-only",
  baseUrl: "https://api.deepseek.com",
  model: "deepseek-v4-flash",
};

Deno.test("DeepSeek usage estimates cache-aware CNY cost", () => {
  const result = estimateProviderCost(deepSeekFlash, {
    prompt_tokens: 3_000,
    prompt_cache_hit_tokens: 1_000,
    prompt_cache_miss_tokens: 2_000,
    completion_tokens: 4_000,
  });
  assert(result);
  assertEquals(result.currency, "CNY");
  assertEquals(result.estimated, true);
  assertEquals(result.amount, 0.01002);
});

Deno.test("gateway-provided cost takes precedence over local pricing", () => {
  const result = estimateProviderCost(deepSeekFlash, {
    prompt_tokens: 3_000,
    completion_tokens: 4_000,
    cost: 0.1234,
    currency: "USD",
  });
  assert(result);
  assertEquals(result.amount, 0.1234);
  assertEquals(result.currency, "USD");
  assertEquals(result.estimated, false);
});

Deno.test("unknown OpenAI-compatible pricing remains explicitly unavailable", () => {
  const result = estimateProviderCost(
    { ...deepSeekFlash, id: "custom", name: "Custom", baseUrl: "https://example.com" },
    { prompt_tokens: 100, completion_tokens: 50 },
  );
  assertEquals(result, undefined);
});
