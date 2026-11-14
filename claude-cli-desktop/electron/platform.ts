import { macOSPlatform } from "./platform/macos.js";
import { windowsPlatform } from "./platform/windows.js";

export interface ClaudeCliInfo {
  path: string;
  version: string;
}

export interface PlatformAdapter {
  inspectClaudeCli(): Promise<ClaudeCliInfo | undefined>;
  buildSystemPath(
    environment: NodeJS.ProcessEnv,
    homeDirectory: string,
    cliPath: string,
  ): string;
  modelIdleTimeoutMs: number;
  idleTimeoutMessage: string;
  quitWhenWindowsClosed: boolean;
  prepareSecretDirectory(secretDirectory: string): Promise<void>;
}

const linuxPlatform: PlatformAdapter = {
  ...macOSPlatform,
  quitWhenWindowsClosed: true,
};

export const desktopPlatform: PlatformAdapter = process.platform === "win32"
  ? windowsPlatform
  : process.platform === "darwin"
  ? macOSPlatform
  : linuxPlatform;
