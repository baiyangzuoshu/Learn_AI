import type { TokenCostEstimate, TokenUsageSummary } from "./contracts.js";

const USD_PER_MILLION_TOKENS = 1_000_000;
const PRICING_AS_OF = "2026-11-14";

interface ModelRates {
  cacheHitOffPeak: number;
  cacheHitPeak: number;
  cacheMissOffPeak: number;
  cacheMissPeak: number;
  outputOffPeak: number;
  outputPeak: number;
}

const MODEL_RATES: Record<TokenCostEstimate["model"], ModelRates> = {
  "deepseek-flash": {
    cacheHitOffPeak: 0.003,
    cacheHitPeak: 0.006,
    cacheMissOffPeak: 0.15,
    cacheMissPeak: 0.3,
    outputOffPeak: 0.6,
    outputPeak: 1.2,
  },
  "deepseek-v4-pro": {
    cacheHitOffPeak: 0.022,
    cacheHitPeak: 0.044,
    cacheMissOffPeak: 0.66,
    cacheMissPeak: 1.32,
    outputOffPeak: 1.98,
    outputPeak: 3.96,
  },
};

function isDeepSeekEndpoint(baseUrl: string): boolean {
  try {
    const hostname = new URL(baseUrl).hostname.toLowerCase();
    return hostname === "deepseek.com" || hostname.endsWith(".deepseek.com");
  } catch {
    return false;
  }
}

function pricingModelFor(model: string): TokenCostEstimate["model"] | undefined {
  const normalized = model.trim().toLowerCase().replace(/\[[^\]]*\]/g, "");
  if (/^deepseek-(?:v4(?:\.1)?-)?flash(?:[-.]|$)/.test(normalized)) return "deepseek-flash";
  if (/^deepseek-v4-pro(?:[-.]|$)/.test(normalized)) return "deepseek-v4-pro";
  return undefined;
}

function roundCny(value: number): number {
  return Math.round(value * 100_000_000) / 100_000_000;
}

export function estimateTokenCost(
  usage: TokenUsageSummary,
  model: string,
  baseUrl: string,
  usdToCnyRate: number,
): TokenCostEstimate | undefined {
  if (!isDeepSeekEndpoint(baseUrl)) return undefined;
  const pricingModel = pricingModelFor(model);
  if (!pricingModel) return undefined;
  if (
    !Number.isSafeInteger(usage.inputTokens) || usage.inputTokens! < 0 ||
    !Number.isSafeInteger(usage.outputTokens) || usage.outputTokens! < 0 ||
    !Number.isFinite(usdToCnyRate) || usdToCnyRate < 1 || usdToCnyRate > 20
  ) return undefined;

  const rates = MODEL_RATES[pricingModel];
  const inputTokens = usage.inputTokens!;
  const outputTokens = usage.outputTokens!;
  const cacheReadTokens = Math.min(
    inputTokens,
    Number.isSafeInteger(usage.cacheReadInputTokens) && usage.cacheReadInputTokens! > 0
      ? usage.cacheReadInputTokens!
      : 0,
  );
  const uncachedInputTokens = inputTokens - cacheReadTokens;
  const offPeakUsd = (
    cacheReadTokens * rates.cacheHitOffPeak +
    uncachedInputTokens * rates.cacheMissOffPeak +
    outputTokens * rates.outputOffPeak
  ) / USD_PER_MILLION_TOKENS;
  const peakUsd = (
    cacheReadTokens * rates.cacheHitPeak +
    uncachedInputTokens * rates.cacheMissPeak +
    outputTokens * rates.outputPeak
  ) / USD_PER_MILLION_TOKENS;

  return {
    lowerCny: roundCny(offPeakUsd * usdToCnyRate),
    upperCny: roundCny(peakUsd * usdToCnyRate),
    model: pricingModel,
    usdToCnyRate,
    pricingAsOf: PRICING_AS_OF,
  };
}
