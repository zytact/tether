import { ipcRenderer } from "electron";
import { soundChannels } from "../shared/ipc";

/** Plays the file the main process sends, then answers once with null, or with why it could not play. */
ipcRenderer.on(soundChannels.play, (_event, data: Uint8Array<ArrayBuffer>) => {
  const url = URL.createObjectURL(new Blob([data]));
  const audio = new Audio(url);
  let finished = false;
  const finish = (error: string | null) => {
    if (finished) return;
    finished = true;
    URL.revokeObjectURL(url);
    ipcRenderer.send(soundChannels.finished, error);
  };
  audio.addEventListener("ended", () => finish(null));
  audio.addEventListener("error", () => finish(audio.error?.message || "the file could not be decoded"));
  audio.play().catch((error: unknown) => finish(String(error)));
});
