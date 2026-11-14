import { access, readdir, realpath } from "node:fs/promises";
import { constants } from "node:fs";
import { delimiter, extname, join } from "node:path";
import { homedir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function inspectClaudeCli(): Promise<
  { path: string; version: string } | undefined
> {
  const home = homedir();
  const isWindows = process.platform === "win32";
  const localAppData = process.env.LOCALAPPDATA ??
    join(home, "AppData", "Local");
  const extraPaths = process.platform === "darwin"
    ? [
      "/opt/homebrew/bin",
      "/usr/local/bin",
      join(home, ".local", "bin"),
      "/usr/bin",
      "/bin",
    ]
    : isWindows
    ? [
      join(home, ".local", "bin"),
      join(localAppData, "Programs", "Claude Code"),
      ...await getWingetClaudeDirectories(localAppData),
    ]
    : [join(home, ".local", "bin"), "/usr/local/bin", "/usr/bin", "/bin"];
  const searchPaths = [
    ...new Set([...(process.env.PATH ?? "").split(delimiter), ...extraPaths]),
  ]
    .filter(Boolean);
  const executableNames = isWindows ? ["claude.exe", "claude.com"] : ["claude"];
  const configuredPath = process.env.CLAUDE_CODE_PATH;
  const configuredCandidates = configuredPath
    ? [
      configuredPath,
      ...(isWindows && !extname(configuredPath)
        ? executableNames.map((name) =>
          `${configuredPath}.${name.split(".").pop()}`
        )
        : []),
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
        timeout: isWindows ? 15000 : 5000,
        env: { ...process.env, PATH: searchPaths.join(delimiter) },
      });
      return { path, version: result.stdout.trim().slice(0, 120) };
    } catch {
      continue;
    }
  }
  return undefined;
}

async function getWingetClaudeDirectories(
  localAppData: string,
): Promise<string[]> {
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
