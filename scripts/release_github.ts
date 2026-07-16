const REPOSITORY = Deno.env.get("GITHUB_REPOSITORY") || "baiyangzuoshu/Learn_AI";
const TOKEN = Deno.env.get("GITHUB_TOKEN") || Deno.env.get("GH_TOKEN");
const VERSION_TAG = Deno.args[0];
const GIT = "/usr/bin/git";
const GREP = "/usr/bin/grep";
const DITTO = "/usr/bin/ditto";
const APP_VERSION_FILE = "desktop/main.ts";
const APP_PATH = "dist/releases/macos-arm64/DenoAgent.app";

if (!VERSION_TAG) {
  fail("用法：deno task release:github v1.0.1");
}
if (!TOKEN) {
  fail("缺少 GITHUB_TOKEN。请先在本机配置 GitHub Personal Access Token。");
}

const appVersion = await readAppVersion();
const tagVersion = normalizeVersion(VERSION_TAG);
if (appVersion !== tagVersion) {
  fail(`APP_VERSION=${appVersion} 与 tag ${VERSION_TAG} 不匹配`);
}

await assertCleanSource();
await run("deno", [
  "fmt",
  "--check",
  APP_VERSION_FILE,
  "desktop/renderer/app.js",
  "desktop/renderer/index.html",
  "README.md",
]);
await run("deno", ["task", "check"]);
await assertNoStageImports();
await run("deno", ["task", "desktop:build:mac-arm64"]);

const assetName = `DenoAgent-${VERSION_TAG}-macos-arm64.zip`;
const assetPath = `dist/releases/macos-arm64/${assetName}`;
await run(DITTO, [
  "-c",
  "-k",
  "--sequesterRsrc",
  "--keepParent",
  APP_PATH,
  assetPath,
]);

const targetCommitish = await output(GIT, ["rev-parse", "HEAD"]);
const release = await getOrCreateRelease(VERSION_TAG, targetCommitish.trim());
await deleteExistingAsset(release.id, assetName);
await uploadAsset(release.id, assetName, assetPath);

console.log(`Release 上传完成：${release.html_url}`);

async function readAppVersion(): Promise<string> {
  const source = await Deno.readTextFile(APP_VERSION_FILE);
  const match = source.match(/^const APP_VERSION = "([^"]+)";$/m);
  if (!match) fail(`无法从 ${APP_VERSION_FILE} 读取 APP_VERSION`);
  return match[1];
}

function normalizeVersion(tag: string): string {
  return tag.replace(/^deno-agent-v/, "").replace(/^v/, "");
}

async function assertCleanSource(): Promise<void> {
  const status = await output(GIT, ["status", "--porcelain", "--untracked-files=no"]);
  const sourceChanges = status.split("\n").filter((line) =>
    line.trim() &&
    !line.includes("dist/") &&
    !line.includes(".DS_Store")
  );
  if (sourceChanges.length) {
    fail(`发布前请先提交源码改动：\n${sourceChanges.join("\n")}`);
  }
}

async function assertNoStageImports(): Promise<void> {
  const result = await new Deno.Command(GREP, {
    args: ["-R", "stages/", "src", "desktop"],
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (result.code === 0) {
    fail(`生产代码不能引用 stages/：\n${new TextDecoder().decode(result.stdout)}`);
  }
  if (result.code !== 1) {
    fail(`检查 stages/ 引用失败：\n${new TextDecoder().decode(result.stderr)}`);
  }
}

async function getOrCreateRelease(
  tag: string,
  targetCommitish: string,
): Promise<{ id: number; html_url: string }> {
  const existing = await github(`/repos/${REPOSITORY}/releases/tags/${encodeURIComponent(tag)}`, {
    method: "GET",
    allowNotFound: true,
  });
  if (existing) return existing as { id: number; html_url: string };

  return await github(`/repos/${REPOSITORY}/releases`, {
    method: "POST",
    body: {
      tag_name: tag,
      target_commitish: targetCommitish,
      name: `Deno Agent ${tag}`,
      body: `Deno Agent ${tag} macOS arm64 release.`,
      draft: false,
      prerelease: false,
    },
  }) as { id: number; html_url: string };
}

async function deleteExistingAsset(releaseId: number, assetName: string): Promise<void> {
  const assets = await github(`/repos/${REPOSITORY}/releases/${releaseId}/assets?per_page=100`, {
    method: "GET",
  }) as { id: number; name: string }[];
  const existing = assets.find((asset) => asset.name === assetName);
  if (!existing) return;
  await github(`/repos/${REPOSITORY}/releases/assets/${existing.id}`, { method: "DELETE" });
}

async function uploadAsset(releaseId: number, assetName: string, assetPath: string): Promise<void> {
  const bytes = await Deno.readFile(assetPath);
  await github(
    `/repos/${REPOSITORY}/releases/${releaseId}/assets?name=${encodeURIComponent(assetName)}`,
    {
      method: "POST",
      upload: true,
      contentType: "application/zip",
      bodyBytes: bytes,
    },
  );
}

async function github(
  path: string,
  options: {
    method: string;
    body?: unknown;
    bodyBytes?: Uint8Array;
    contentType?: string;
    upload?: boolean;
    allowNotFound?: boolean;
  },
): Promise<unknown> {
  const baseUrl = options.upload ? "https://uploads.github.com" : "https://api.github.com";
  const body = options.bodyBytes
    ? options.bodyBytes.buffer.slice(
      options.bodyBytes.byteOffset,
      options.bodyBytes.byteOffset + options.bodyBytes.byteLength,
    ) as ArrayBuffer
    : options.body
    ? JSON.stringify(options.body)
    : undefined;
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method,
    headers: {
      "accept": "application/vnd.github+json",
      "authorization": `Bearer ${TOKEN}`,
      "content-type": options.contentType || "application/json",
      "x-github-api-version": "2022-11-28",
    },
    body,
  });
  if (options.allowNotFound && response.status === 404) return undefined;
  if (!response.ok) {
    const text = await response.text();
    fail(`GitHub API ${options.method} ${path} 失败：HTTP ${response.status}\n${text}`);
  }
  if (response.status === 204) return undefined;
  return await response.json();
}

async function run(command: string, args: string[]): Promise<void> {
  console.log(`$ ${[command, ...args].join(" ")}`);
  const result = await new Deno.Command(command, {
    args,
    stdout: "inherit",
    stderr: "inherit",
  }).output();
  if (!result.success) fail(`${command} ${args.join(" ")} 执行失败`);
}

async function output(command: string, args: string[]): Promise<string> {
  const result = await new Deno.Command(command, {
    args,
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!result.success) {
    fail(new TextDecoder().decode(result.stderr).trim() || `${command} 执行失败`);
  }
  return new TextDecoder().decode(result.stdout);
}

function fail(message: string): never {
  console.error(message);
  Deno.exit(1);
}
