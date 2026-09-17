/** The two apps this code ships as. A preview installs beside the release and keeps its own name,
 * settings, open-at-login entry and single-instance lock. `scripts/package.ts` bundles each one from
 * this table, and the running app finds its entry again by the name it was bundled with. */
export const identities = {
  release: {
    productName: "Tether",
    appId: "dev.arnab.tether",
    executableName: "tether",
    icons: "build/icons",
  },
  preview: {
    productName: "Tether Preview",
    appId: "dev.arnab.tether.preview",
    executableName: "tether-preview",
    icons: "build/icons/preview",
  },
} as const;

export type Identity = (typeof identities)[keyof typeof identities];
