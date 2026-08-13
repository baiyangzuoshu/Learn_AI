import { generateSeedreamImages } from "../src/providers/seedream.ts";
import type { ImageGenerationConfig } from "../src/providers/contracts.ts";

function assert(condition: unknown, message = "assertion failed"): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEquals<T>(actual: T, expected: T): void {
  if (!Object.is(actual, expected)) {
    throw new Error(`expected ${String(expected)}, got ${String(actual)}`);
  }
}

const config: ImageGenerationConfig = {
  provider: "volcengine-ark",
  apiKey: "test-only-secret",
  baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
  model: "doubao-seedream-4-5-251128",
};

Deno.test("Seedream sends a bounded single-image request and decodes PNG", async () => {
  let capturedUrl = "";
  let capturedInit: RequestInit | undefined;
  const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const result = await generateSeedreamImages(
    config,
    { prompt: "一只橘猫", size: "2K", watermark: true },
    undefined,
    (url, init) => {
      capturedUrl = String(url);
      capturedInit = init;
      return Promise.resolve(
        Response.json({ data: [{ b64_json: btoa(String.fromCharCode(...png)) }] }),
      );
    },
  );
  assertEquals(capturedUrl, "https://ark.cn-beijing.volces.com/api/v3/images/generations");
  assert(capturedInit);
  const body = JSON.parse(String(capturedInit.body));
  assertEquals(body.model, config.model);
  assertEquals(body.response_format, "b64_json");
  assertEquals(body.sequential_image_generation, "disabled");
  assertEquals(result[0].extension, "png");
  assertEquals(result[0].bytes.length, png.length);
});

Deno.test("Seedream error response is surfaced without retrying", async () => {
  let message = "";
  try {
    await generateSeedreamImages(
      config,
      { prompt: "test", size: "1K", watermark: false },
      undefined,
      () => Promise.resolve(new Response("model unavailable", { status: 404 })),
    );
  } catch (error) {
    message = error instanceof Error ? error.message : String(error);
  }
  assert(message.includes("HTTP 404"));
  assert(message.includes("model unavailable"));
});
