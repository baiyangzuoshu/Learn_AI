import { getPublicSettings, saveUpdateSettings } from "../../src/config/settings.ts";

export const APP_VERSION = "1.0.1";
const UPDATE_CHECK_TIMEOUT_MS = 8_000;
const UPDATE_DOWNLOAD_TIMEOUT_MS = 120_000;

type UpdateManifest = {
  version?: string;
  tag_name?: string;
  url?: string;
  html_url?: string;
  releaseUrl?: string;
  downloadUrl?: string;
  notes?: string;
  body?: string;
  assets?: {
    name?: string;
    browser_download_url?: string;
    state?: string;
  }[];
};

function extractVersion(value: string): string {
  return value.match(/\d+(?:\.\d+){1,3}/)?.[0] ?? "";
}

function compareVersions(left: string, right: string): number {
  const parse = (value: string) =>
    extractVersion(value).split(".").map(Number).filter(Number.isFinite);
  const a = parse(left);
  const b = parse(right);
  for (let index = 0; index < Math.max(a.length, b.length); index++) {
    const diff = (a[index] ?? 0) - (b[index] ?? 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}

function selectUpdateDownloadUrl(manifest: UpdateManifest): string | undefined {
  if (manifest.downloadUrl) return manifest.downloadUrl;
  const assets = Array.isArray(manifest.assets) ? manifest.assets : [];
  return assets
    .filter((asset) => asset.browser_download_url && asset.state !== "deleted")
    .filter((asset) => (asset.name ?? "").toLowerCase().endsWith(".zip"))
    .map((asset) => {
      const name = (asset.name ?? "").toLowerCase();
      let score = 0;
      if (name.includes("denoagent") || name.includes("deno-agent")) score += 4;
      if (name.includes("macos") || name.includes("darwin")) score += 3;
      if (name.includes("arm64") || name.includes("aarch64")) score += 3;
      if (name.includes("x64") || name.includes("x86_64")) score -= 1;
      return { asset, score };
    })
    .sort((a, b) => b.score - a.score)[0]?.asset.browser_download_url;
}

function validateUpdateDownloadUrl(downloadUrl: string): void {
  const parsed = new URL(downloadUrl);
  const isLocalDev = parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost";
  if (parsed.protocol !== "https:" && !(isLocalDev && parsed.protocol === "http:")) {
    throw new Error("更新包下载地址必须使用 HTTPS；本地开发只允许 localhost HTTP");
  }
  if (!parsed.pathname.toLowerCase().endsWith(".zip")) {
    throw new Error("当前自动更新只支持 .zip 更新包");
  }
}

async function currentAppBundlePath(): Promise<string | undefined> {
  let path = await Deno.realPath(Deno.execPath());
  while (path && path !== "/") {
    if (path.endsWith(".app") && (await Deno.stat(path)).isDirectory) return path;
    const trimmed = path.replace(/\/+$/, "");
    const slash = trimmed.lastIndexOf("/");
    path = slash <= 0 ? "/" : trimmed.slice(0, slash);
  }
  return undefined;
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

async function downloadUpdateArchive(downloadUrl: string, archivePath: string): Promise<void> {
  validateUpdateDownloadUrl(downloadUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPDATE_DOWNLOAD_TIMEOUT_MS);
  try {
    const response = await fetch(downloadUrl, {
      headers: { "accept": "application/octet-stream" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`更新包下载失败：HTTP ${response.status}`);
    await Deno.writeFile(archivePath, new Uint8Array(await response.arrayBuffer()));
  } finally {
    clearTimeout(timeout);
  }
}

export async function checkForUpdate(): Promise<{
  configured: boolean;
  currentVersion: string;
  latestVersion?: string;
  updateAvailable: boolean;
  releaseUrl?: string;
  downloadUrl?: string;
  notes?: string;
  checkedAt?: string;
  message: string;
}> {
  const settings = await getPublicSettings();
  const updateUrl = settings.update.updateUrl.trim();
  if (!updateUrl) {
    return {
      configured: false,
      currentVersion: APP_VERSION,
      updateAvailable: false,
      message: "未配置更新源；可在设置中填写 HTTPS manifest 或 GitHub release API URL",
    };
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPDATE_CHECK_TIMEOUT_MS);
  try {
    const response = await fetch(updateUrl, {
      headers: { "accept": "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`更新源返回 HTTP ${response.status}`);
    const manifest = await response.json() as UpdateManifest;
    const latestVersion = extractVersion(String(manifest.version ?? manifest.tag_name ?? ""));
    if (!latestVersion) throw new Error("更新源缺少 version 或 tag_name 字段");
    const releaseUrl = manifest.releaseUrl ?? manifest.html_url ?? manifest.url;
    const downloadUrl = selectUpdateDownloadUrl(manifest);
    const checkedAt = new Date().toISOString();
    await saveUpdateSettings({ lastCheckAt: checkedAt, latestVersion, releaseUrl });
    const updateAvailable = compareVersions(latestVersion, APP_VERSION) > 0;
    return {
      configured: true,
      currentVersion: APP_VERSION,
      latestVersion,
      updateAvailable,
      releaseUrl,
      downloadUrl,
      notes: manifest.notes ?? manifest.body,
      checkedAt,
      message: updateAvailable ? `发现新版本 ${latestVersion}` : "当前已是最新版本",
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function installUpdateAndRestart(): Promise<{
  ok: true;
  version: string;
  message: string;
}> {
  if (Deno.build.os !== "darwin") throw new Error("当前自动安装更新仅支持 macOS");
  const update = await checkForUpdate();
  if (!update.updateAvailable || !update.latestVersion) {
    throw new Error("当前已是最新版本，无需更新");
  }
  if (!update.downloadUrl) {
    throw new Error("GitHub Release 未找到可安装的 macOS arm64 .zip 资产");
  }
  const appPath = await currentAppBundlePath();
  if (!appPath) {
    throw new Error("开发模式不支持自动替换应用；请用打包后的 DenoAgent.app 测试");
  }
  const appParent = appPath.slice(0, appPath.lastIndexOf("/"));
  const tempDir = await Deno.makeTempDir({ prefix: "deno-agent-update-" });
  const archivePath = `${tempDir}/DenoAgent-${update.latestVersion}.zip`;
  const scriptPath = `${tempDir}/install-update.sh`;
  const backupPath = `${appPath}.bak-${Date.now()}`;
  await downloadUpdateArchive(update.downloadUrl, archivePath);
  const script = `#!/bin/sh
set -eu
APP_PATH=${shellQuote(appPath)}
APP_PARENT=${shellQuote(appParent)}
ARCHIVE_PATH=${shellQuote(archivePath)}
BACKUP_PATH=${shellQuote(backupPath)}
TEMP_DIR=${shellQuote(tempDir)}
APP_PID=${Deno.pid}
while kill -0 "$APP_PID" 2>/dev/null; do sleep 0.2; done
rm -rf "$BACKUP_PATH"
if [ -d "$APP_PATH" ]; then mv "$APP_PATH" "$BACKUP_PATH"; fi
/usr/bin/ditto -x -k "$ARCHIVE_PATH" "$APP_PARENT"
if [ ! -d "$APP_PATH" ]; then
  if [ -d "$BACKUP_PATH" ]; then mv "$BACKUP_PATH" "$APP_PATH"; fi
  exit 1
fi
rm -rf "$BACKUP_PATH"
/usr/bin/open "$APP_PATH"
rm -rf "$TEMP_DIR"
`;
  await Deno.writeTextFile(scriptPath, script);
  new Deno.Command("/bin/sh", {
    args: [scriptPath],
    stdin: "null",
    stdout: "null",
    stderr: "null",
  }).spawn();
  setTimeout(() => Deno.exit(0), 300);
  return {
    ok: true,
    version: update.latestVersion,
    message: `已下载 ${update.latestVersion}，应用即将退出并重新打开`,
  };
}
