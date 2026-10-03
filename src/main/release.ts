import { createPublicKey, verify } from "node:crypto";
import type { ReleaseChange, ReleaseNotes, ReleaseNotice } from "../shared/ipc";
import { parseReleaseNotices } from "../shared/release-notice";
import { isNewer, validVersion } from "../shared/version";

/** The Ed25519 key, as base64 DER, whose private half `scripts/sign-update.ts` signs releases with. */
const PUBLIC_KEY = "MCowBQYDK2VwAyEA46vmOVepLdxypU8GlHKd94GwJtvToGniARSBIwwpMFc=";

/** The manifest key for each bundle the release workflow publishes. */
export type PlatformKey = "linux-x86_64-deb" | "linux-x86_64-rpm" | "darwin-aarch64" | "windows-x86_64";
type ReleaseAsset = { url: string; signature: string };
type Manifest = {
  version: string;
  minimumVersion: string | null;
  notices: ReleaseNotice[];
  platforms: Record<string, ReleaseAsset>;
};
/** A release newer than the running build, with the download for this platform. */
export type PendingUpdate =
  | (ReleaseAsset & { version: string; manualInstall: false; notices: ReleaseNotice[] })
  | { version: string; manualInstall: true; notices: ReleaseNotice[] };

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
  const minimumVersion = value.minimumVersion;
  if (minimumVersion !== undefined && (typeof minimumVersion !== "string" || !validVersion(minimumVersion))) {
    throw new Error("the release manifest has an invalid minimum version");
  }
  return {
    version: value.version,
    minimumVersion: minimumVersion ?? null,
    notices: parseReleaseNotices(value.notices ?? []),
    platforms,
  };
}

/** The manifest's release when it is newer than `current`, with the download for `platform`. A newer
 * release without one is an error, since the app would otherwise never hear of it. */
export function pendingUpdate(manifest: Manifest, current: string, platform: PlatformKey | null): PendingUpdate | null {
  if (!isNewer(manifest.version, current)) return null;
  if (manifest.minimumVersion && isNewer(manifest.minimumVersion, current)) {
    return { version: manifest.version, manualInstall: true, notices: [] };
  }
  const asset = platform === null ? undefined : manifest.platforms[platform];
  if (!asset) throw new Error(`the release has no update for ${platform ?? process.platform}`);
  const notices = manifest.notices.filter(
    (notice) =>
      !isNewer(notice.fromVersion, current) &&
      !isNewer(current, notice.throughVersion) &&
      (!notice.platforms || notice.platforms.includes(process.platform as "linux" | "darwin" | "win32")),
  );
  return { version: manifest.version, manualInstall: false, notices, ...asset };
}

/** The wait before the next check after a failure, doubling from `RETRY_START` up to `interval`. */
export function nextRetry(retry: number | null, interval: number): number {
  return retry === null ? RETRY_START : Math.min(retry * 2, interval);
}

export { isNewer } from "../shared/version";

export function parseReleases(value: unknown, after: string, through: string): ReleaseNotes[] {
  if (!Array.isArray(value)) throw new Error("the release list is malformed");
  const releases = value.flatMap((release) => {
    if (!isPublishedRelease(release)) return [];
    const version = release.tag_name.replace(/^v/, "");
    if (!validVersion(version) || !isNewer(version, after) || isNewer(version, through)) return [];
    return [releaseNotes(release, version)];
  });
  return releases.sort((a, b) => (isNewer(a.version, b.version) ? -1 : isNewer(b.version, a.version) ? 1 : 0));
}

type PublishedRelease = { tag_name: string; body?: unknown; published_at?: unknown };

function isPublishedRelease(value: unknown): value is PublishedRelease {
  return isRecord(value) && typeof value.tag_name === "string" && value.draft === false && value.prerelease === false;
}

function releaseNotes(release: PublishedRelease, version: string): ReleaseNotes {
  return {
    version,
    publishedAt: typeof release.published_at === "string" ? release.published_at : null,
    changes: typeof release.body === "string" ? parseChanges(release.body) : [],
  };
}

const sectionKinds: Partial<Record<string, ReleaseChange["kind"]>> = { Features: "new", "Bug Fixes": "fixed" };
const typeKinds: Partial<Record<string, ReleaseChange["kind"]>> = { feat: "new", fix: "fixed" };

/** Reads the changes from a release body. release-please groups them under headings and links each
 * to its pull request and commit, while older releases list GitHub's generated PR titles. */
function parseChanges(body: string): ReleaseChange[] {
  let section = "";
  return body.split(/\r?\n/).flatMap((line): ReleaseChange[] => {
    const heading = /^#+\s+(.*)$/.exec(line);
    if (heading) section = heading[1].trim();
    const bullet = /^\s*[-*]\s+(.+)$/.exec(line);
    if (!bullet || section === "New Contributors" || section.includes("BREAKING CHANGES")) return [];
    const generated = / by @\S+ in \S+$/.exec(bullet[1]);
    return [generated ? generatedChange(bullet[1].slice(0, generated.index)) : releasePleaseChange(bullet[1], section)];
  });
}

function generatedChange(title: string): ReleaseChange {
  const commit = /^(\w+)(?:\(([^)]*)\))?!?:\s*(.+)$/.exec(title.trim());
  if (!commit) return { kind: "changed", scope: null, summary: title.trim() };
  return { kind: typeKinds[commit[1]] ?? "changed", scope: commit[2] || null, summary: commit[3] };
}

function releasePleaseChange(line: string, section: string): ReleaseChange {
  const text = line.replace(/,\s+closes\s+\[.*$/i, "").replace(/\s*\(\[(?:#\d+|[0-9a-f]{7,40})\]\([^)]*\)\)/g, "");
  const scoped = /^\*\*([^*]+):\*\*\s*(.+)$/.exec(text);
  return {
    kind: sectionKinds[section] ?? "changed",
    scope: scoped ? scoped[1] : null,
    summary: plainText(scoped ? scoped[2] : text),
  };
}

/** Drops the inline Markdown a release-please summary can carry, keeping the text of links and code. */
const plainText = (markdown: string) =>
  markdown
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\*\*|`/g, "")
    .trim();

/** Whether `signature`, base64, is the release key's Ed25519 signature of `data`. */
export function verifySignature(data: Buffer, signature: string, publicKey = PUBLIC_KEY): boolean {
  try {
    const key = createPublicKey({ key: Buffer.from(publicKey, "base64"), format: "der", type: "spki" });
    return verify(null, data, key, Buffer.from(signature, "base64"));
  } catch {
    return false;
  }
}
