import { Buffer } from "node:buffer";
import type { ImageGenerationConfig } from "./contracts.ts";

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

export interface GeneratedImageData {
  bytes: Uint8Array;
  extension: "jpg" | "png" | "webp";
  contentType: "image/jpeg" | "image/png" | "image/webp";
}

export interface SeedreamRequest {
  prompt: string;
  size: "1K" | "2K" | "4K";
  watermark: boolean;
}

function imageType(bytes: Uint8Array): Omit<GeneratedImageData, "bytes"> {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { extension: "jpg", contentType: "image/jpeg" };
  }
  if (
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
  ) return { extension: "png", contentType: "image/png" };
  if (
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) return { extension: "webp", contentType: "image/webp" };
  throw new Error("图片生成服务返回了不支持的文件格式");
}

export async function generateSeedreamImages(
  config: ImageGenerationConfig,
  request: SeedreamRequest,
  signal?: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<GeneratedImageData[]> {
  const response = await fetcher(`${config.baseUrl}/images/generations`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      prompt: request.prompt,
      size: request.size,
      response_format: "b64_json",
      sequential_image_generation: "disabled",
      watermark: request.watermark,
    }),
    signal,
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 2_000);
    throw new Error(`火山方舟图片生成失败（HTTP ${response.status}）：${detail}`);
  }
  const payload = await response.json() as { data?: Array<{ b64_json?: string }> };
  const encoded =
    payload.data?.map((item) => item.b64_json).filter((item): item is string => Boolean(item)) ??
      [];
  if (!encoded.length) throw new Error("火山方舟没有返回图片数据");
  if (encoded.length !== 1) throw new Error("火山方舟返回了非预期数量的图片");
  return encoded.map((value) => {
    const bytes = Buffer.from(value, "base64");
    if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) {
      throw new Error(`生成图片大小无效（最大 ${MAX_IMAGE_BYTES / 1024 / 1024} MB）`);
    }
    return { bytes, ...imageType(bytes) };
  });
}
