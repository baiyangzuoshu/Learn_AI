import { execFile } from "node:child_process";
import { constants } from "node:fs";
import { access, chmod, mkdir, realpath } from "node:fs/promises";
import { promisify } from "node:util";
import { homedir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import type { PlatformAdapter } from "../platform.js";

const execFileAsync = promisify(execFile);
const MODEL_IDLE_TIMEOUT_MS = 90_000;
const IDLE_TIMEOUT_MESSAGE = "连续 90 秒没有收到模型进展，本次请求已自动停止。请检查网络或 DeepSeek 服务状态后重试。";

async function inspectClaudeCli() {
  const home = homedir();
  const extraPaths = [
    "/opt/homebrew/bin",
    "/usr/local/bin",
    join(home, ".local", "bin"),
    "/usr/bin",
    "/bin",
  ];
  const searchPaths = [
    ...new Set([...(process.env.PATH ?? "").split(delimiter), ...extraPaths]),
  ].filter(Boolean);
  const candidates = [
    ...new Set([
      ...(process.env.CLAUDE_CODE_PATH ? [process.env.CLAUDE_CODE_PATH] : []),
      ...searchPaths.map((directory) => join(directory, "claude")),
    ]),
  ];

  for (const candidate of candidates) {
    try {
      await access(candidate, constants.X_OK);
      const path = await realpath(candidate);
      const result = await execFileAsync(path, ["--version"], {
        timeout: 5_000,
        env: { ...process.env, PATH: searchPaths.join(delimiter) },
      });
      return { path, version: result.stdout.trim().slice(0, 120) };
    } catch {
      continue;
    }
  }
  return undefined;
}

function buildSystemPath(
  environment: NodeJS.ProcessEnv,
  homeDirectory: string,
  cliPath: string,
): string {
  const extras = [
    "/opt/homebrew/bin",
    "/usr/local/bin",
    join(homeDirectory, ".local", "bin"),
    "/usr/bin",
    "/bin",
    dirname(cliPath),
  ];
  return [...new Set([...(environment.PATH ?? "").split(delimiter), ...extras])]
    .filter(Boolean)
    .join(delimiter);
}

async function prepareSecretDirectory(secretDirectory: string): Promise<void> {
  await mkdir(secretDirectory, { recursive: true, mode: 0o700 });
  await chmod(secretDirectory, 0o700);
}

export const macOSPlatform: PlatformAdapter = {
  inspectClaudeCli,
  buildSystemPath,
  modelIdleTimeoutMs: MODEL_IDLE_TIMEOUT_MS,
  idleTimeoutMessage: IDLE_TIMEOUT_MESSAGE,
  quitWhenWindowsClosed: false,
  prepareSecretDirectory,
};
