import type { Bridge } from "../shared/ipc";

declare global {
  interface Window {
    /** The preload's typed channel to the main process. */
    tether: Bridge;
  }
}
