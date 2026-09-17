import { build } from "electron-builder";
import { identities } from "../src/main/identity.ts";

/** Bundles the app for the platform it runs on from `dist/` and `dist-electron/`, which `vp build` and
 * `vp pack` write. `--preview` bundles the preview identity, and `--dir` stops at the unpacked app. */
const identity = process.argv.includes("--preview") ? identities.preview : identities.release;
const unpacked = process.argv.includes("--dir");

await build({
  publish: "never",
  config: {
    appId: identity.appId,
    productName: identity.productName,
    extraMetadata: {
      name: identity.executableName,
      productName: identity.productName,
      desktopName: identity.productName,
    },
    directories: { output: `release/${identity.executableName}`, buildResources: "build" },
    electronDist: "node_modules/electron/dist",
    files: ["dist/**", "dist-electron/**", "package.json"],
    // Never published by the builder. It is set so the Linux packages record their format in
    // `resources/package-type`, which the updater reads to pick its download.
    publish: { provider: "github", owner: "zytact", repo: "tether" },
    linux: {
      target: unpacked ? "dir" : ["deb", "rpm"],
      executableName: identity.executableName,
      icon: `${identity.icons}/icon.png`,
      category: "Utility",
      maintainer: "Arnab",
      syncDesktopName: true,
    },
    deb: { artifactName: "${name}_${version}_amd64.${ext}" },
    rpm: { artifactName: "${name}-${version}.x86_64.${ext}" },
    mac: {
      target: unpacked
        ? "dir"
        : [
            { target: "dmg", arch: "arm64" },
            { target: "tar.gz", arch: "arm64" },
          ],
      icon: `${identity.icons}/icon.png`,
      category: "public.app-category.utilities",
      // Ad-hoc, without an Apple Developer ID. The updater checks its own signature instead.
      identity: "-",
      hardenedRuntime: false,
      artifactName: "${productName}_${version}_aarch64.app.${ext}",
    },
    dmg: { artifactName: "${productName}_${version}_aarch64.${ext}" },
    win: {
      target: unpacked ? "dir" : "nsis",
      executableName: identity.executableName,
      icon: `${identity.icons}/icon.png`,
    },
    nsis: {
      oneClick: true,
      perMachine: false,
      artifactName: "${productName}_${version}_x64-setup.${ext}",
    },
  },
});
