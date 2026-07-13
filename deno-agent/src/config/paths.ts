export function appDataDir(): string {
  const home = Deno.env.get(Deno.build.os === "windows" ? "USERPROFILE" : "HOME");
  if (Deno.build.os === "windows") {
    const appData = Deno.env.get("APPDATA");
    if (appData) return `${appData}/DenoAgent`;
  }
  if (!home) throw new Error("User home directory is unavailable");
  if (Deno.build.os === "darwin") return `${home}/Library/Application Support/DenoAgent`;
  return `${Deno.env.get("XDG_DATA_HOME") ?? `${home}/.local/share`}/DenoAgent`;
}
