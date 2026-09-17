import react from "@vitejs/plugin-react";
import { defineConfig, lazyPlugins } from "vite-plus";

/** Build output and the hand-laid-out agent skill docs. */
const notOurs = ["dist/**", "dist-electron/**", "release/**", ".agents/**", ".claude/**"];

/** The packaged window loads its page from disk, so the policy ships as a meta tag. The dev server
 * injects an inline script for fast refresh, so it only applies to builds. */
const CONTENT_SECURITY_POLICY = "default-src 'self'; style-src 'self' 'unsafe-inline'";

/** A sandboxed preload cannot load an ES module, or a chunk shared with another preload, so each one is
 * bundled on its own. */
const preload = (entry: Record<string, string>) => ({
  entry,
  format: "cjs" as const,
  outDir: "dist-electron",
  clean: false,
  deps: { neverBundle: ["electron"] },
});

export default defineConfig({
  plugins: lazyPlugins(() => [
    react(),
    {
      name: "content-security-policy",
      apply: "build",
      transformIndexHtml: () => [
        {
          tag: "meta",
          attrs: { "http-equiv": "Content-Security-Policy", content: CONTENT_SECURITY_POLICY },
          injectTo: "head-prepend",
        },
      ],
    },
  ]),
  // The window loads the build from the file system, where absolute asset paths do not resolve.
  base: "./",
  clearScreen: false,
  server: { port: 1421, strictPort: true },
  pack: [
    {
      entry: { main: "src/main/index.ts" },
      format: "esm",
      outDir: "dist-electron",
      clean: false,
      deps: { neverBundle: ["electron"] },
      loader: { ".png": "dataurl" },
    },
    preload({ preload: "src/preload/index.ts" }),
    preload({ sound: "src/preload/sound.ts" }),
  ],
  fmt: {
    ignorePatterns: notOurs,
    printWidth: 120,
  },
  lint: {
    ignorePatterns: notOurs,
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    options: { typeAware: true, typeCheck: true },
  },
  staged: {
    "*.{ts,tsx,js,jsx,json,css,html,md}": "vp check --fix",
  },
});
