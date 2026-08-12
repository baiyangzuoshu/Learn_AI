import { appDataPath } from "../platform.ts";

export function appDataDir(): string {
  return appDataPath();
}
