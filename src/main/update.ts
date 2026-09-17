import { execFile, spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { access, mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { promisify } from "node:util";
import { app } from "electron";
import type { AvailableUpdate } from "../shared/ipc";
import { nextRetry, parseManifest, pendingUpdate, verifySignature } from "./release";
import type { PendingUpdate, PlatformKey } from "./release";

export const MANIFEST_URL = "https://github.com/zytact/tether/releases/latest/download/latest.json";
const CHECK_INTERVAL = 6 * 60 * 60 * 1000;
const DOWNLOAD_TIMEOUT = 10 * 60 * 1000;

const run = promisify(execFile);

const platformKeys: Partial<Record<string, PlatformKey>> = {
  "darwin-arm64": "darwin-aarch64",
  "win32-x64": "windows-x86_64",
};

/** The manifest key for the bundle this app was installed from, so an rpm install never downloads
 * the deb. */
function platformKey(): PlatformKey | null {
  const target = `${process.platform}-${process.arch}`;
  return target === "linux-x64" ? linuxPackageKey() : (platformKeys[target] ?? null);
}

/** electron-builder records a Linux package's format beside the app. */
function linuxPackageKey(): PlatformKey | null {
  const marker = join(process.resourcesPath, "package-type");
  const packageType = existsSync(marker) ? readFileSync(marker, "utf8").trim() : null;
  return packageType === "deb" || packageType === "rpm" ? `linux-x86_64-${packageType}` : null;
}

/** Finds signed releases newer than the running build and installs them. The release it last found
 * stays on offer through an install, so a failed one leaves nothing to put back. Without a manifest,
 * as in dev and preview builds, it never checks. */
export class Updater {
  private pending: PendingUpdate | null = null;
  private installing = false;

  constructor(
    private readonly manifestUrl: string | undefined,
    private readonly announce: (update: AvailableUpdate) => void,
  ) {}

  available(): AvailableUpdate | null {
    return this.pending && { version: this.pending.version };
  }

  async check(): Promise<AvailableUpdate | null> {
    if (!this.manifestUrl) throw new Error("dev and preview builds never update");
    const response = await fetch(this.manifestUrl, { signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`the release manifest returned ${response.status}`);
    const update = pendingUpdate(parseManifest(await response.json()), app.getVersion(), platformKey());
    if (!update) return null;
    this.pending = update;
    this.announce({ version: update.version });
    return { version: update.version };
  }

  /** Checks at launch and every `CHECK_INTERVAL`, backing off after a failure. */
  async watch() {
    if (!this.manifestUrl) return;
    let retry: number | null = null;
    for (;;) {
      retry = await this.check().then(
        () => null,
        (error: unknown) => {
          console.error("Update check failed:", error);
          return nextRetry(retry, CHECK_INTERVAL);
        },
      );
      await sleep(retry ?? CHECK_INTERVAL);
    }
  }

  /** Downloads the pending update, verifies its signature, installs it, then relaunches into it. A
   * deb or rpm install asks for an administrator password through polkit. */
  async install() {
    const update = this.pending;
    if (!update) throw new Error("No update is ready to install.");
    if (this.installing) throw new Error("The update is already installing.");
    this.installing = true;
    try {
      await installUpdate(update);
    } finally {
      this.installing = false;
    }
  }
}

async function installUpdate(update: PendingUpdate) {
  const directory = await mkdtemp(join(app.getPath("temp"), "tether-update-"));
  try {
    await installFile(await download(update, directory));
  } catch (error) {
    await removeDirectory(directory);
    throw error;
  }
  // The NSIS installer still runs from the directory once the app exits, and starts the new version itself.
  if (process.platform !== "win32") {
    await removeDirectory(directory);
    app.relaunch();
  }
  app.exit(0);
}

/** Saves the update into `directory` once its signature checks out, and returns the file. */
async function download(update: PendingUpdate, directory: string): Promise<string> {
  // A stalled download would otherwise hold the install open, and every retry refused, for good.
  const response = await fetch(update.url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT) });
  if (!response.ok) throw new Error(`the download returned ${response.status}`);
  const data = Buffer.from(await response.arrayBuffer());
  if (!verifySignature(data, update.signature)) throw new Error("the download failed its signature check");
  const file = join(directory, basename(new URL(update.url).pathname));
  await writeFile(file, data);
  return file;
}

async function installFile(file: string) {
  switch (process.platform) {
    case "win32":
      return launchWindowsInstaller(file);
    case "darwin":
      return replaceAppBundle(file);
    default:
      await run("pkexec", platformKey()?.endsWith("-rpm") ? ["rpm", "-U", file] : ["dpkg", "-i", file]);
  }
}

const removeDirectory = (directory: string) =>
  rm(directory, { recursive: true, force: true }).catch((error: unknown) =>
    console.error("Failed to remove the update directory:", error),
  );

async function launchWindowsInstaller(file: string) {
  const installer = spawn(file, ["--updated", "/S", "--force-run"], { detached: true, stdio: "ignore" });
  await new Promise<void>((resolve, reject) => {
    installer.once("spawn", resolve);
    installer.once("error", reject);
  });
  installer.unref();
}

/** Unpacks the new bundle beside the running one, so the swap is a rename on one volume, and puts the
 * old bundle back if the swap fails. */
async function replaceAppBundle(archive: string) {
  const bundle = join(process.execPath, "..", "..", "..");
  const staging = await mkdtemp(join(dirname(bundle), ".tether-update-"));
  const unpacked = join(staging, basename(bundle));
  const previous = join(staging, "previous.app");
  try {
    await run("tar", ["-xzf", archive, "-C", staging]);
    await access(join(unpacked, "Contents", "Info.plist"));
    await rename(bundle, previous);
    try {
      await rename(unpacked, bundle);
    } catch (error) {
      await rename(previous, bundle);
      throw error;
    }
  } finally {
    // The staging directory holds the previous bundle, so it goes only while an app sits in place.
    if (existsSync(bundle)) await rm(staging, { recursive: true, force: true });
  }
}
