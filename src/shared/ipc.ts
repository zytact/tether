import type { BatteryCheck } from "./battery";
import type { Settings } from "./settings";

/** Every request the window can make of the main process, keyed by channel. */
export type Commands = {
  settings: () => Settings;
  /** Validates and saves every field in the change, applies it to the running monitor, and returns the result. */
  updateSettings: (change: Partial<Settings>) => Settings;
  /** Asks for a sound file and returns its path, or null when the dialog is cancelled. */
  chooseSound: () => string | null;
  openAtLogin: () => boolean;
  setOpenAtLogin: (enabled: boolean) => void;
};

/** What the main process publishes to the window, keyed by channel. The window can also read the
 * latest value of each, which is null until there is one. */
export type Events = {
  batteryCheck: BatteryCheck;
};

/** The channel that serves the latest value of an event. */
export const CURRENT = "current";

/** A command's result as it crosses the process boundary. Electron rewrites a thrown error's message,
 * so a failure travels as a value and the preload throws it again. */
export type Reply<T> = { ok: true; value: T } | { ok: false; error: string };

/** What the preload exposes to the window as `window.tether`. */
export type Bridge = {
  platform: NodeJS.Platform;
  invoke<C extends keyof Commands>(command: C, ...args: Parameters<Commands[C]>): Promise<ReturnType<Commands[C]>>;
  on<E extends keyof Events>(event: E, listener: (payload: Events[E]) => void): () => void;
  current<E extends keyof Events>(event: E): Promise<Events[E] | null>;
};

/** The channels between the main process and the hidden window that plays alert sounds. */
export const soundChannels = { play: "sound:play", finished: "sound:finished" } as const;
