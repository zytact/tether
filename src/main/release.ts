import { createPublicKey, verify } from "node:crypto";

/** The Ed25519 key, as base64 DER, whose private half `scripts/sign-update.ts` signs releases with. */
const PUBLIC_KEY = "MCowBQYDK2VwAyEA46vmOVepLdxypU8GlHKd94GwJtvToGniARSBIwwpMFc=";

type ReleaseAsset = { url: string; signature: string };
type Manifest = { version: string; platforms: Record<string, ReleaseAsset> };
/** A release newer than the running build, with the download for this platform. */
export type PendingUpdate = ReleaseAsset & { version: string };

/** A launch at login usually beats the network up, so a failed check comes back well before the
 * next interval. */
const RETRY_START = 5 * 60 * 1000;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Reads the `latest.json` the release workflow publishes, keeping only the platforms that name both a
 * download and a signature. */
export function parseManifest(value: unknown): Manifest {
  if (!isRecord(value) || typeof value.version !== "string" || !isRecord(value.platforms)) {
    throw new Error("the release manifest is malformed");
  }
  const platforms: Record<string, ReleaseAsset> = {};
  for (const [key, asset] of Object.entries(value.platforms)) {
    if (isRecord(asset) && typeof asset.url === "string" && typeof asset.signature === "string") {
      platforms[key] = { url: asset.url, signature: asset.signature };
    }
  }
  return { version: value.version, platforms };
}

/** The manifest's release when it is newer than `current`, with the download for `platform`. A newer
 * release without one is an error, since the app would otherwise never hear of it. */
export function pendingUpdate(manifest: Manifest, current: string, platform: string | null): PendingUpdate | null {
  if (!isNewer(manifest.version, current)) return null;
  const asset = platform === null ? undefined : manifest.platforms[platform];
  if (!asset) throw new Error(`the release has no update for ${platform ?? process.platform}`);
  return { version: manifest.version, ...asset };
}

/** The wait before the next check after a failure, doubling from `RETRY_START` up to `interval`. */
export function nextRetry(retry: number | null, interval: number): number {
  return retry === null ? RETRY_START : Math.min(retry * 2, interval);
}

/** Releases are plain `major.minor.patch`. */
function isNewer(candidate: string, current: string): boolean {
  const [a, b] = [candidate, current].map((version) => version.split(".").map(Number));
  for (let index = 0; index < 3; index++) {
    if ((a[index] ?? 0) !== (b[index] ?? 0)) return (a[index] ?? 0) > (b[index] ?? 0);
  }
  return false;
}

/** Whether `signature`, base64, is the release key's Ed25519 signature of `data`. */
export function verifySignature(data: Buffer, signature: string, publicKey = PUBLIC_KEY): boolean {
  try {
    const key = createPublicKey({ key: Buffer.from(publicKey, "base64"), format: "der", type: "spki" });
    return verify(null, data, key, Buffer.from(signature, "base64"));
  } catch {
    return false;
  }
}
