import { type ChildProcess, spawn, type SpawnOptions } from "node:child_process";
import { Buffer } from "node:buffer";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export type CommandResult = {
  success: boolean;
  code: number | null;
  stdout: string;
  stderr: string;
};

export type SecretStore = {
  get(service: string, account: string): Promise<string | undefined>;
  set(service: string, account: string, value: string): Promise<void>;
};

let secretStore: SecretStore | undefined;
let permissionPrompt: ((message: string) => boolean) | undefined;
let folderChooser: (() => Promise<string | undefined>) | undefined;
let configuredAppDataPath: string | undefined;

export const isWindows = process.platform === "win32";
export const isMacOS = process.platform === "darwin";

export function environment(name: string): string | undefined {
  return process.env[name];
}

export function platformVersion(): string {
  return `Node.js ${process.version}`;
}

export function appDataPath(): string {
  if (configuredAppDataPath) return configuredAppDataPath;
  const root = isWindows
    ? process.env.APPDATA
    : isMacOS
    ? process.env.HOME && `${process.env.HOME}/Library/Application Support`
    : (process.env.XDG_DATA_HOME ?? (process.env.HOME && `${process.env.HOME}/.local/share`));
  if (!root) throw new Error("User application data directory is unavailable");
  return `${root}/AIAgent`;
}

export function setAppDataPath(path: string): void {
  configuredAppDataPath = path;
}

export function isNotFound(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}

export function setSecretStore(store: SecretStore): void {
  secretStore = store;
}

export async function readSecret(service: string, account: string): Promise<string | undefined> {
  return await secretStore?.get(service, account);
}

export async function writeSecret(service: string, account: string, value: string): Promise<void> {
  if (!secretStore) throw new Error("安全凭据存储尚未初始化");
  await secretStore.set(service, account, value);
}

export function setPermissionPrompt(prompt: (message: string) => boolean): void {
  permissionPrompt = prompt;
}

export function setFolderChooser(chooser: () => Promise<string | undefined>): void {
  folderChooser = chooser;
}

export async function chooseFolder(): Promise<string | undefined> {
  return await folderChooser?.();
}

export function confirmPermission(message: string): boolean {
  return permissionPrompt?.(message) ?? false;
}

export async function writeJsonAtomic(path: string, value: unknown): Promise<void> {
  await writeTextAtomic(path, `${JSON.stringify(value, null, 2)}\n`);
}

export async function writeTextAtomic(path: string, content: string): Promise<void> {
  await writeBufferAtomic(path, Buffer.from(content, "utf8"));
}

export async function writeBufferAtomic(path: string, content: Uint8Array): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${crypto.randomUUID()}.tmp`;
  await writeFile(temporary, content);
  await rename(temporary, path);
}

export async function readUtf8(path: string): Promise<string> {
  return await readFile(path, "utf8");
}

export async function runCommand(
  command: string,
  args: string[],
  options: SpawnOptions = {},
): Promise<CommandResult> {
  const child = spawn(command, args, { ...options, stdio: ["ignore", "pipe", "pipe"] });
  const stdout: Buffer[] = [];
  const stderr: Buffer[] = [];
  child.stdout?.on("data", (chunk: Buffer) => stdout.push(chunk));
  child.stderr?.on("data", (chunk: Buffer) => stderr.push(chunk));
  return await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code) =>
      resolve({
        success: code === 0,
        code,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      }));
  });
}

export function spawnCommand(
  command: string,
  args: string[],
  options: SpawnOptions = {},
): ChildProcess {
  return spawn(command, args, { ...options, stdio: ["ignore", "pipe", "pipe"] });
}
