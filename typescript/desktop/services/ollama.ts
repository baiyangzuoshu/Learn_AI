const OLLAMA_TAGS_URL = "http://127.0.0.1:11434/api/tags";

export interface OllamaModelsResult {
  available: boolean;
  models: string[];
}

function modelNames(payload: unknown): string[] {
  if (!payload || typeof payload !== "object") return [];
  const raw = payload as { models?: unknown };
  if (!Array.isArray(raw.models)) return [];
  return [
    ...new Set(
      raw.models.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const name = (item as { name?: unknown }).name;
        const normalized = typeof name === "string" ? name.trim() : "";
        return normalized && normalized.length <= 200 ? [normalized] : [];
      }).slice(0, 200),
    ),
  ];
}

export async function listOllamaModels(): Promise<OllamaModelsResult> {
  try {
    const response = await fetch(OLLAMA_TAGS_URL, { signal: AbortSignal.timeout(1_500) });
    if (!response.ok) return { available: false, models: [] };
    return { available: true, models: modelNames(await response.json()) };
  } catch {
    return { available: false, models: [] };
  }
}
