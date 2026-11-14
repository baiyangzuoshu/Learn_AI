import { execFile } from "node:child_process";
import { constants } from "node:fs";
import { access, mkdir, readdir, realpath } from "node:fs/promises";
import { promisify } from "node:util";
import { homedir } from "node:os";
import { delimiter, dirname, extname, join } from "node:path";
import type { PlatformAdapter } from "../platform.js";

const execFileAsync = promisify(execFile);
const WINDOWS_MODEL_IDLE_TIMEOUT_MS = 10 * 60_000;
const WINDOWS_IDLE_TIMEOUT_MESSAGE = "Claude Code CLI 连续 10 分钟没有模型进展，本次请求已自动停止。请检查 Studio 设置中的 API 地址、模型和网络连接后重试。";

async function inspectClaudeCli() {
  const home = homedir();
  const localAppData = process.env.LOCALAPPDATA ??
    join(home, "AppData", "Local");
  const extraPaths = [
    join(home, ".local", "bin"),
    join(localAppData, "Programs", "Claude Code"),
    ...await getWingetClaudeDirectories(localAppData),
  ];
  const searchPaths = [
    ...new Set([...(process.env.PATH ?? "").split(delimiter), ...extraPaths]),
  ].filter(Boolean);
  const executableNames = ["claude.exe", "claude.com"];
  const configuredPath = process.env.CLAUDE_CODE_PATH;
  const configuredCandidates = configuredPath
    ? [
      configuredPath,
      ...(extname(configuredPath)
        ? []
        : executableNames.map((name) =>
          `${configuredPath}.${name.split(".").pop()}`
        )),
    ]
    : [];
  const candidates = [
    ...new Set([
      ...configuredCandidates,
      ...searchPaths.flatMap((directory) =>
        executableNames.map((name) => join(directory, name))
      ),
    ]),
  ];

  for (const candidate of candidates) {
    try {
      await access(candidate, constants.X_OK);
      const path = await realpath(candidate);
      const result = await execFileAsync(path, ["--version"], {
        timeout: 15_000,
        env: { ...process.env, PATH: searchPaths.join(delimiter) },
      });
      return { path, version: result.stdout.trim().slice(0, 120) };
    } catch {
      continue;
    }
  }
  return undefined;
}

async function getWingetClaudeDirectories(localAppData: string): Promise<string[]> {
  const packagesDirectory = join(
    localAppData,
    "Microsoft",
    "WinGet",
    "Packages",
  );
  try {
    const entries = await readdir(packagesDirectory, { withFileTypes: true });
    return entries
      .filter((entry) =>
        entry.isDirectory() &&
        entry.name.toLowerCase().startsWith("anthropic.claudecode_")
      )
      .map((entry) => join(packagesDirectory, entry.name));
  } catch {
    return [];
  }
}

function buildSystemPath(
  environment: NodeJS.ProcessEnv,
  homeDirectory: string,
  cliPath: string,
): string {
  const extras = [join(homeDirectory, ".local", "bin"), dirname(cliPath)];
  return [...new Set([...(environment.PATH ?? "").split(delimiter), ...extras])]
    .filter(Boolean)
    .join(delimiter);
}

async function prepareSecretDirectory(secretDirectory: string): Promise<void> {
  // AppData directories inherit the current Windows user's access controls.
  await mkdir(secretDirectory, { recursive: true });
}

export const windowsPlatform: PlatformAdapter = {
  inspectClaudeCli,
  buildSystemPath,
  modelIdleTimeoutMs: WINDOWS_MODEL_IDLE_TIMEOUT_MS,
  idleTimeoutMessage: WINDOWS_IDLE_TIMEOUT_MESSAGE,
  quitWhenWindowsClosed: true,
  prepareSecretDirectory,
};
