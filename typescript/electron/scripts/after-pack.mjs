import { execFile } from "node:child_process";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export default async function afterPack(context) {
  if (context.electronPlatformName !== "darwin") return;

  const appPath = join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  try {
    await execFileAsync("codesign", ["--verify", "--deep", "--strict", appPath]);
    return;
  } catch {
    // The stock Electron archive is signed, but packaging changes invalidate that
    // signature. Ad-hoc signing keeps local builds launchable when no Developer ID
    // certificate is configured; a later real signing step can replace it.
  }

  await execFileAsync("codesign", ["--force", "--deep", "--sign", "-", "--timestamp=none", appPath]);
  console.log(`  • applied ad-hoc macOS signature  app=${appPath}`);
}
