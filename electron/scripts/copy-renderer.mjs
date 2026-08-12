import { cp, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const electronRoot = fileURLToPath(new URL("../", import.meta.url));
const workspaceRoot = fileURLToPath(new URL("../../", import.meta.url));
const destination = join(electronRoot, "dist", "renderer");
await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
await cp(join(workspaceRoot, "desktop/renderer"), destination, { recursive: true });
await cp(join(workspaceRoot, "desktop/assets/app-icon.png"), join(destination, "app-icon.png"));
