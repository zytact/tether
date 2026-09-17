import { contextBridge, ipcRenderer } from "electron";
import type { IpcRendererEvent } from "electron";
import { CURRENT } from "../shared/ipc";
import type { Bridge, Commands, Events, Reply } from "../shared/ipc";

const bridge: Bridge = {
  platform: process.platform,
  async invoke<C extends keyof Commands>(command: C, ...args: Parameters<Commands[C]>) {
    const reply: Reply<ReturnType<Commands[C]>> = await ipcRenderer.invoke(command, ...args);
    if (!reply.ok) throw new Error(reply.error);
    return reply.value;
  },
  on<E extends keyof Events>(event: E, listener: (payload: Events[E]) => void) {
    const forward = (_event: IpcRendererEvent, payload: Events[E]) => listener(payload);
    ipcRenderer.on(event, forward);
    return () => {
      ipcRenderer.off(event, forward);
    };
  },
  current: (event) => ipcRenderer.invoke(CURRENT, event),
};

contextBridge.exposeInMainWorld("rustcharge", bridge);
