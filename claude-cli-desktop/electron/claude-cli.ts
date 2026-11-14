import { access, realpath } from "node:fs/promises";
import { constants } from "node:fs";
import { delimiter, join } from "node:path";
import { homedir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function inspectClaudeCli(): Promise<{ path: string; version: string } | undefined> {
  const home = homedir();
  const extraPaths = process.platform === "darwin"
    ? ["/opt/homebrew/bin", "/usr/local/bin", join(home, ".local/bin"), "/usr/bin", "/bin"]
    : [join(home, ".local/bin"), "/usr/local/bin", "/usr/bin", "/bin"];
  const searchPaths = [...(process.env.PATH ?? "").split(delimiter), ...extraPaths]
    .filter(Boolean);
  const candidates = [...new Set([
    ...(process.env.CLAUDE_CODE_PATH ? [process.env.CLAUDE_CODE_PATH] : []),
    ...searchPaths.map((directory) => join(directory, "claude")),
  ])];

  for (const candidate of candidates) {
    try {
      await access(candidate, constants.X_OK);
      const path = await realpath(candidate);
      const result = await execFileAsync(path, ["--version"], {
        timeout: 5000,
        env: { ...process.env, PATH: searchPaths.join(delimiter) },
      });
      return { path, version: result.stdout.trim().slice(0, 120) };
    } catch {
      continue;
    }
  }
  return undefined;
}
