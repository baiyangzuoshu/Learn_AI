import { loadDesktopAssets } from "./assets.ts";

export async function desktopAssets(rendererRoot: string) {
  return await loadDesktopAssets(rendererRoot);
}
