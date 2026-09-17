import { generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, it } from "vite-plus/test";
import { nextRetry, parseManifest, pendingUpdate, verifySignature } from "./release";

const asset = { url: "https://x/tether.rpm", signature: "c2ln" };

describe("release manifest", () => {
  it("keeps the platforms that name both a download and a signature", () => {
    expect(
      parseManifest({
        version: "3.1.0",
        platforms: { "windows-x86_64": { url: "https://x/setup.exe", signature: "c2ln" }, "linux-x86_64-deb": {} },
      }),
    ).toEqual({ version: "3.1.0", platforms: { "windows-x86_64": { url: "https://x/setup.exe", signature: "c2ln" } } });
    expect(() => parseManifest({ platforms: {} })).toThrow();
  });

  it("offers only a later version", () => {
    const offered = (version: string, current: string) =>
      pendingUpdate({ version, platforms: { deb: asset } }, current, "deb") !== null;
    expect(offered("3.0.1", "3.0.0")).toBe(true);
    expect(offered("3.1.0", "3.0.99")).toBe(true);
    expect(offered("3.0.0", "3.0.0")).toBe(false);
    expect(offered("2.9.9", "3.0.0")).toBe(false);
  });

  it("offers the download for the installed bundle, and fails a newer release without one", () => {
    const manifest = { version: "3.1.0", platforms: { "linux-x86_64-rpm": asset } };
    expect(pendingUpdate(manifest, "3.0.0", "linux-x86_64-rpm")).toEqual({ version: "3.1.0", ...asset });
    expect(() => pendingUpdate(manifest, "3.0.0", "linux-x86_64-deb")).toThrow("no update for linux-x86_64-deb");
    expect(() => pendingUpdate(manifest, "3.0.0", null)).toThrow();
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
