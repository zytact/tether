import { join } from "node:path";
import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, nativeTheme, Notification, Tray } from "electron";
import appIcon from "../../build/icons/icon.png";
import previewAppIcon from "../../build/icons/preview/icon.png";
import previewTrayIcon from "../../build/icons/preview/tray.png";
import trayIcon from "../../build/icons/tray.png";
import type { BatteryCheck } from "../shared/battery";
import { CURRENT } from "../shared/ipc";
import type { Commands, Events, Reply } from "../shared/ipc";
import { readBattery } from "./battery";
import { identities } from "./identity";
import { Monitor } from "./monitor";
import { alertNotification } from "./notification";
import { launchedHidden, openAtLogin, setOpenAtLogin } from "./open-at-login";
import { changeSettings, loadSettings, saveSettings } from "./settings";
import { SoundPlayer } from "./sound";
import { trayItems } from "./tray-menu";
import type { TrayAction } from "./tray-menu";

const identity = app.getName() === identities.preview.productName ? identities.preview : identities.release;
const preview = identity === identities.preview;

// Settings and the single-instance lock live under the user data directory, so keying it by the
// identifier keeps a preview's apart from the release's.
app.setPath("userData", join(app.getPath("appData"), identity.appId));

/** The window shell paints before the page does, so it carries the same canvas color the stylesheet
 * uses. Without it a dark desktop gets a cream flash on every open. */
const canvas = () => (nativeTheme.shouldUseDarkColors ? "#0a0a0a" : "#fbf8f1");

const page = join(import.meta.dirname, "..", "dist");
const devServer = app.isPackaged ? undefined : process.env.VITE_DEV_SERVER_URL;
const appImage = () => nativeImage.createFromDataURL(preview ? previewAppIcon : appIcon);
// Preview builds can read a stand-in battery, so verification can drive every threshold on demand.
const powerSupply = (preview && process.env.TETHER_POWER_SUPPLY) || undefined;

let mainWindow: BrowserWindow | null = null;

/** A second launch belongs to the instance already in the tray, so it raises that window instead of
 * starting a rival monitor with its own tray icon. */
if (!app.requestSingleInstanceLock()) {
  app.exit(0);
} else {
  app.on("second-instance", showWindow);
  // Closing the window leaves the monitor running in the tray. Only Quit ends the process.
  app.on("window-all-closed", () => {});
  void app.whenReady().then(start);
}

function start() {
  Menu.setApplicationMenu(
    process.platform === "darwin"
      ? Menu.buildFromTemplate([{ role: "appMenu" }, { role: "editMenu" }, { role: "windowMenu" }])
      : null,
  );
  // Windows shows notifications only for an app with a user model id.
  if (process.platform === "win32") app.setAppUserModelId(identity.appId);

  const settingsPath = join(app.getPath("userData"), "settings.json");
  const sound = new SoundPlayer();
  const renderTray = createTray();
  let lastCheck: BatteryCheck | null = null;
  const monitor = new Monitor(loadSettings(settingsPath), {
    readBattery: () => readBattery(powerSupply),
    alert: (reading, settings) => {
      new Notification({ ...alertNotification(reading, settings, process.platform), icon: appImage() }).show();
      if (settings.soundPath !== null) void sound.play(settings.soundPath);
    },
    checked: (check) => {
      lastCheck = check;
      renderTray(check);
      publish("batteryCheck", check);
    },
  });

  ipcMain.handle(CURRENT, (_event, event: keyof Events) => (event === "batteryCheck" ? lastCheck : null));
  handleCommands(monitor, settingsPath);

  // Clicking the dock icon on macOS reopens the window.
  app.on("activate", showWindow);
  if (!launchedHidden()) showWindow();
  monitor.start();
}

/** Returns what redraws the menu for a new battery check. */
function createTray() {
  const tray = new Tray(trayImage());
  tray.setToolTip(identity.productName);
  // macOS opens the menu on a left click; elsewhere the click opens the window and the menu keeps its
  // own button.
  if (process.platform !== "darwin") tray.on("click", showWindow);
  const actions: Record<TrayAction, () => void> = { show: showWindow, quit: () => app.quit() };
  const render = (check: BatteryCheck | null) =>
    tray.setContextMenu(
      Menu.buildFromTemplate(
        trayItems(check, identity.productName).map((item) =>
          item === "separator"
            ? { type: "separator" }
            : {
                label: item.label,
                enabled: item.action !== null,
                click: item.action ? actions[item.action] : undefined,
              },
        ),
      ),
    );
  render(null);
  return render;
}

function handleCommands(monitor: Monitor, settingsPath: string) {
  handle("settings", () => monitor.settings);
  handle("updateSettings", (change) => {
    const next = changeSettings(monitor.settings, change);
    try {
      saveSettings(settingsPath, next);
    } catch (error) {
      throw new Error(`Could not save settings: ${message(error)}`);
    }
    monitor.update(next);
    return next;
  });
  handle("chooseSound", async () => {
    const options: Electron.OpenDialogOptions = {
      title: "Choose an alert sound",
      properties: ["openFile"],
      filters: [{ name: "Audio", extensions: ["mp3", "wav", "ogg", "oga", "flac", "m4a", "aac", "opus", "webm"] }],
    };
    const result = mainWindow ? await dialog.showOpenDialog(mainWindow, options) : await dialog.showOpenDialog(options);
    return result.filePaths[0] ?? null;
  });
  handle("openAtLogin", () => openAtLogin(identity));
  handle("setOpenAtLogin", (enabled) => setOpenAtLogin(identity, enabled === true));
}

/** Closing the window destroys it, so the tray and a normal launch build it afresh. A closed window
 * holds no renderer process while the monitor runs in the tray. */
function showWindow() {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
    return;
  }
  const window = new BrowserWindow({
    title: identity.productName,
    icon: appImage(),
    width: 460,
    height: 720,
    minWidth: 360,
    minHeight: 480,
    backgroundColor: canvas(),
    webPreferences: { preload: join(import.meta.dirname, "preload.cjs"), sandbox: true, contextIsolation: true },
  });
  mainWindow = window;
  const paint = () => window.setBackgroundColor(canvas());
  nativeTheme.on("updated", paint);
  window.on("closed", () => {
    nativeTheme.off("updated", paint);
    mainWindow = null;
  });
  // The title names the build, so a preview is told apart from the release, whatever the page says.
  window.on("page-title-updated", (event) => event.preventDefault());
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event) => event.preventDefault());
  void (devServer ? window.loadURL(devServer) : window.loadFile(join(page, "index.html")));
}

/** macOS draws the release mark from its alpha channel as a template image, and the preview mark in color,
 * since both share one silhouette. */
function trayImage() {
  const image = nativeImage.createFromDataURL(preview ? previewTrayIcon : trayIcon);
  if (process.platform !== "darwin") return image;
  const sized = image.resize({ height: 18, quality: "best" });
  sized.addRepresentation({ scaleFactor: 2, buffer: image.resize({ height: 36, quality: "best" }).toPNG() });
  sized.setTemplateImage(!preview);
  return sized;
}

function publish<E extends keyof Events>(event: E, payload: Events[E]) {
  mainWindow?.webContents.send(event, payload);
}

function handle<C extends keyof Commands>(
  command: C,
  run: (...args: Parameters<Commands[C]>) => ReturnType<Commands[C]> | Promise<ReturnType<Commands[C]>>,
) {
  ipcMain.handle(command, async (_event, ...args: Parameters<Commands[C]>): Promise<Reply<ReturnType<Commands[C]>>> => {
    try {
      return { ok: true, value: await run(...args) };
    } catch (error) {
      return { ok: false, error: message(error) };
    }
  });
}

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));
