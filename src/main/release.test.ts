import { generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, it } from "vite-plus/test";
import { nextRetry, parseManifest, parseReleases, pendingUpdate, verifySignature } from "./release";

const asset = { url: "https://x/tether.rpm", signature: "c2ln" };

describe("release manifest", () => {
  it("keeps the platforms that name both a download and a signature", () => {
    expect(
      parseManifest({
        version: "3.1.1",
        platforms: { "windows-x86_64": { url: "https://x/setup.exe", signature: "c2ln" }, "linux-x86_64-deb": {} },
      }),
    ).toEqual({
      version: "3.1.1",
      minimumVersion: null,
      notices: [],
      platforms: { "windows-x86_64": { url: "https://x/setup.exe", signature: "c2ln" } },
    });
    expect(() => parseManifest({ platforms: {} })).toThrow();
  });

  it("offers only a later version", () => {
    const offered = (version: string, current: string) =>
      pendingUpdate(
        parseManifest({ version, platforms: { "linux-x86_64-deb": asset } }),
        current,
        "linux-x86_64-deb",
      ) !== null;
    expect(offered("3.0.1", "3.0.0")).toBe(true);
    expect(offered("3.1.1", "3.0.99")).toBe(true);
    expect(offered("3.0.0", "3.0.0")).toBe(false);
    expect(offered("2.9.9", "3.0.0")).toBe(false);
  });

  it("offers the download for the installed bundle, and fails a newer release without one", () => {
    const manifest = parseManifest({ version: "3.1.1", platforms: { "linux-x86_64-rpm": asset } });
    expect(pendingUpdate(manifest, "3.0.0", "linux-x86_64-rpm")).toEqual({
      version: "3.1.1",
      manualInstall: false,
      notices: [],
      ...asset,
    });
    expect(() => pendingUpdate(manifest, "3.0.0", "linux-x86_64-deb")).toThrow("no update for linux-x86_64-deb");
    expect(() => pendingUpdate(manifest, "3.0.0", null)).toThrow();
  });

  it("requires a fresh install below the minimum version", () => {
    const manifest = parseManifest({ version: "3.1.1", minimumVersion: "3.0.0", platforms: {} });
    expect(pendingUpdate(manifest, "2.9.9", "linux-x86_64-deb")).toEqual({
      version: "3.1.1",
      manualInstall: true,
      notices: [],
    });
  });

  it("selects notices for the installed version and platform", () => {
    const manifest = parseManifest({
      version: "3.1.1",
      platforms: { "linux-x86_64-rpm": asset },
      notices: [
        { id: "linux", message: "Restart first", fromVersion: "3.0.0", throughVersion: "3.0.0", platforms: ["linux"] },
        { id: "old", message: "Old version", fromVersion: "2.0.0", throughVersion: "2.9.9" },
      ],
    });
    expect(pendingUpdate(manifest, "3.0.0", "linux-x86_64-rpm")?.notices.map(({ id }) => id)).toEqual(["linux"]);
  });

  it("collects published notes between installed and target versions", () => {
    expect(
      parseReleases(
        [
          {
            tag_name: "v3.1.0",
            draft: false,
            prerelease: false,
            published_at: "2026-01-01",
            body: "* feat(ui): show progress by @a in https://x\n* fix: retry installs by @a in https://x",
          },
          { tag_name: "v2.9.0", draft: false, prerelease: false, body: "* feat: too old" },
        ],
        "3.0.0",
        "3.1.1",
      ),
    ).toEqual([
      {
        version: "3.1.0",
        publishedAt: "2026-01-01",
        changes: [
          { kind: "new", scope: "ui", summary: "show progress" },
          { kind: "fixed", scope: null, summary: "retry installs" },
        ],
      },
    ]);
  });

  it("reads release-please notes as plain text grouped by section", () => {
    const body = [
      "## [3.4.0](https://x/compare/v3.3.0...v3.4.0) (2026-10-03)",
      "### ⚠ BREAKING CHANGES",
      "* **tray:** drop the old icon",
      "### Features",
      "* **tray:** drop the old icon ([#30](https://x/30)) ([abc1234](https://x/abc1234))",
      "* color the tray by wear ([#27](https://x/27)) ([820785c](https://x/820785c))  ",
      "### Bug Fixes",
      "* keep `vp check` and [docs](https://x/docs) readable ([def5678](https://x/def5678))",
      "* show the ([setup guide](https://x/setup)) ([#31](https://x/31)) ([0a1b2c3](https://x/0a1b2c3)), closes [#26](https://x/26)",
    ].join("\n");
    expect(
      parseReleases([{ tag_name: "v3.4.0", draft: false, prerelease: false, body }], "3.3.0", "3.4.0")[0].changes,
    ).toEqual([
      { kind: "new", scope: "tray", summary: "drop the old icon" },
      { kind: "new", scope: null, summary: "color the tray by wear" },
      { kind: "fixed", scope: null, summary: "keep vp check and docs readable" },
      { kind: "fixed", scope: null, summary: "show the (setup guide)" },
    ]);
  });

  it("backs off a failed check up to the interval", () => {
    expect(nextRetry(null, 60 * 60_000)).toBe(5 * 60_000);
    expect(nextRetry(20 * 60_000, 60 * 60_000)).toBe(40 * 60_000);
    expect(nextRetry(40 * 60_000, 60 * 60_000)).toBe(60 * 60_000);
  });

  it("accepts only a download signed with the release key", () => {
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    const key = publicKey.export({ format: "der", type: "spki" }).toString("base64");
    const data = Buffer.from("release bundle");
    const signature = sign(null, data, privateKey).toString("base64");

    expect(verifySignature(data, signature, key)).toBe(true);
    expect(verifySignature(Buffer.from("tampered"), signature, key)).toBe(false);
    expect(verifySignature(data, signature)).toBe(false);
    expect(verifySignature(data, "not a signature", key)).toBe(false);
  });
});
