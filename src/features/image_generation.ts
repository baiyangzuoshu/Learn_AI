import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { resolveImageGenerationConfig } from "../config/settings.ts";
import type { HarnessFeature } from "../contracts.ts";
import type { ToolDefinition } from "../core/types.ts";
import { writeBufferAtomic } from "../platform.ts";
import { generateSeedreamImages } from "../providers/seedream.ts";

const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "generate_image",
    description: "Generate one image with Volcengine Ark Seedream and save it in the workspace",
    parameters: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "Detailed image prompt, preferably in Chinese" },
        size: { type: "string", enum: ["1K", "2K", "4K"], default: "2K" },
        watermark: {
          type: "boolean",
          default: true,
          description: "Whether the generated image includes the provider watermark",
        },
      },
      required: ["prompt"],
    },
  },
};

export const imageGeneration: HarnessFeature = {
  id: "image-generation",
  register({ tools, prompts }) {
    tools.register(definition, async (input, context) => {
      const prompt = String(input.prompt ?? "").trim();
      if (!prompt || prompt.length > 4_000) throw new Error("图片提示词长度必须为 1–4000 字符");
      const size = String(input.size ?? "2K");
      if (!["1K", "2K", "4K"].includes(size)) throw new Error("图片尺寸仅支持 1K、2K 或 4K");
      const config = await resolveImageGenerationConfig();
      context.budget.consume("cost");
      const images = await generateSeedreamImages(config, {
        prompt,
        size: size as "1K" | "2K" | "4K",
        watermark: input.watermark !== false,
      }, context.signal);
      const directory = join(context.workspace, ".ai-agent", "generated-images");
      await mkdir(directory, { recursive: true });
      const results = [];
      for (const [index, image] of images.entries()) {
        const name = `${new Date().toISOString().replace(/[:.]/g, "-")}-${
          crypto.randomUUID().slice(0, 8)
        }${images.length > 1 ? `-${index + 1}` : ""}.${image.extension}`;
        const relativePath = `.ai-agent/generated-images/${name}`;
        await writeBufferAtomic(join(context.workspace, relativePath), image.bytes);
        const url = `/api/workspace/image?path=${encodeURIComponent(relativePath)}`;
        results.push({ path: relativePath, url, markdown: `![生成图片](${url})` });
      }
      return JSON.stringify({ provider: config.provider, model: config.model, images: results });
    });
    prompts.register({
      id: "image-generation",
      title: "Image generation",
      priority: 35,
      content:
        "When the user asks to create a raster image, call generate_image. After success, include the returned markdown image verbatim in the final response so the desktop client can preview it. Generated files stay under .ai-agent/generated-images in the active workspace.",
    });
  },
};
