import { createPrivateKey, sign } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

/** Writes `<file>.sig` beside each file named, the base64 Ed25519 signature the updater checks. The
 * `UPDATE_SIGNING_KEY` environment variable holds the private key as PEM. */
const pem = process.env.UPDATE_SIGNING_KEY;
if (!pem) throw new Error("UPDATE_SIGNING_KEY is not set.");
const key = createPrivateKey(pem);
for (const file of process.argv.slice(2)) {
  writeFileSync(`${file}.sig`, sign(null, readFileSync(file), key).toString("base64"));
}
