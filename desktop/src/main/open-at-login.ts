import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { app } from "electron";
import type { Identity } from "./identity";

/** The login registration launches with this flag so the app settles into the tray instead of pushing
 * a window at someone who has just signed in. */
const HIDDEN_FLAG = "--hidden";

/** macOS registers the app itself rather than a command line, so it reports the login launch
 * instead of passing the flag. */
export function launchedHidden(): boolean {
  return (
    process.argv.includes(HIDDEN_FLAG) || (process.platform === "darwin" && app.getLoginItemSettings().wasOpenedAtLogin)
  );
}

/** Linux has no login item API, so the registration is an XDG autostart entry. */
function autostartEntry(identity: Identity): string {
  return join(
    process.env.XDG_CONFIG_HOME || join(homedir(), ".config"),
    "autostart",
    `${identity.executableName}.desktop`,
  );
}

/** Read from the operating system on every call, since the registration can change from outside the app. */
export function openAtLogin(identity: Identity): boolean {
  if (process.platform === "linux") return existsSync(autostartEntry(identity));
  return app.getLoginItemSettings({ args: [HIDDEN_FLAG] }).openAtLogin;
}

export function setOpenAtLogin(identity: Identity, enabled: boolean) {
  if (process.platform !== "linux") {
    app.setLoginItemSettings({ openAtLogin: enabled, args: [HIDDEN_FLAG] });
    return;
  }
  const entry = autostartEntry(identity);
  if (!enabled) {
    rmSync(entry, { force: true });
    return;
  }
  mkdirSync(dirname(entry), { recursive: true });
  writeFileSync(
    entry,
    [
      "[Desktop Entry]",
      "Type=Application",
      `Name=${identity.productName}`,
      `Exec="${execQuoted(process.execPath)}" ${HIDDEN_FLAG}`,
      "X-GNOME-Autostart-enabled=true",
      "",
    ].join("\n"),
  );
}

/** A path inside a quoted Exec argument. The value is unescaped as a desktop entry string, then as a quoted
 * argument, so a backslash is written four times and `"`, `` ` `` and `$` take one escaping backslash. */
export function execQuoted(path: string): string {
  return path.replaceAll("\\", "\\\\\\\\").replaceAll(/["`$]/g, "\\$&").replaceAll("%", "%%");
}
