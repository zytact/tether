import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { BrowserWindow } from "electron";
import { soundChannels } from "../shared/ipc";

/** Plays alert sounds in a hidden window, since only a renderer can decode audio. The window lives only while
 * a sound plays, and a sound asked for while another is playing is skipped rather than queued. */
export class SoundPlayer {
  private playing = false;

  async play(path: string) {
    if (this.playing) {
      console.error("Skipped the alert sound because another one is still playing.");
      return;
    }
    this.playing = true;
    let window: BrowserWindow | null = null;
    try {
      const data = await readFile(path);
      window = new BrowserWindow({
        show: false,
        webPreferences: {
          preload: join(import.meta.dirname, "sound.cjs"),
          sandbox: true,
          contextIsolation: true,
          autoplayPolicy: "no-user-gesture-required",
        },
      });
      await window.loadURL("about:blank");
      const { webContents } = window;
      const error = await new Promise<string | null>((resolve) => {
        webContents.ipc.once(soundChannels.finished, (_event, message: string | null) => resolve(message));
        webContents.once("render-process-gone", () => resolve("the sound window stopped"));
        webContents.send(soundChannels.play, data);
      });
      if (error !== null) throw new Error(error);
    } catch (error) {
      console.error(`Failed to play ${path}:`, error);
    } finally {
      window?.destroy();
      this.playing = false;
    }
  }
}
