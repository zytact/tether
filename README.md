# Tether

An Electron tray app for Linux, macOS, and Windows. It watches the battery and sends a desktop notification, with an optional sound, when a charging battery reaches the high level or a discharging one drops to the low level.

Tether replaces Rustcharge, the Rust CLI that used to live in this repository. It has no flags and no `set` command. Every setting lives in its window and applies to the running monitor as soon as it changes.

## Run

```sh
vp install
vp run dev
```

`vp` is the [Vite+](https://viteplus.dev) CLI. Install it with `curl -fsSL https://vite.plus | bash`. It manages Node, pnpm, and the toolchain. `vp run dev` serves the page with hot reload and rebuilds the main process as it changes; main process changes take effect on the next launch.

Launching Tether opens the settings window. Closing it leaves the monitor running in the tray, whose menu shows the latest battery reading, reopens the window, and quits. Only one instance runs at a time, so launching it again reopens the window of the one already running. **Open at login** starts it in the tray without the window.

## Settings

| Setting             | Default     | What it does                                                                         |
| ------------------- | ----------- | ------------------------------------------------------------------------------------ |
| High battery        | 85%, on     | Alert while charging at or above the level.                                          |
| Low battery         | 20%, on     | Alert while discharging at or below the level.                                       |
| Alerts per crossing | 15          | Alerts stop after this many until the battery leaves the level and crosses it again. |
| Check every         | 120 seconds | How often the battery is read, from 1 second to a day.                               |
| Sound               | none        | A file played with each alert. Without one, the notification keeps the system sound. |
| Urgency             | Normal      | Linux only. Low, Normal, or Critical.                                                |
| Open at login       | off         | Starts the app in the tray at sign-in.                                               |

Settings are saved to `settings.json` in the app's config directory, which is `~/.config/dev.arnab.tether/` on Linux. A saved value that is no longer valid falls back to its default without resetting the others.

Changing a threshold or switching it on or off ends that threshold's alerts and reads the battery at once, so a new level can alert straight away. Changing the interval starts a new one from that moment. Sound, urgency, and alert count changes keep the current alerts' count and the next scheduled check.

A sound plays in a hidden window that exists only while it plays. When an alert arrives while the previous sound is still playing, its sound is skipped.

## Battery readings

- Linux reads the first `/sys/class/power_supply` entry of type `Battery`, skipping peripheral batteries with a `Device` scope. Only the `Charging` status counts as charging, so a full battery on AC is not charging.
- macOS reads `pmset -g batt`.
- Windows reads the battery driver's `BatteryStatus` and `BatteryFullChargedCapacity` through PowerShell, and counts only its charging flag as charging, so a full battery on AC is not charging.

## Build and check

```sh
vp check
vp test
vp build
vp pack
vp run package
```

`vp check` verifies formatting with Oxfmt, lints with Oxlint, and type checks. Add `--fix` to rewrite instead of report. A pre-commit hook runs `vp staged`, which applies `vp check --fix` to the staged files. `vp run fallow` audits the change against `origin/main` for dead code, duplication, and complexity.

`vp run package` builds the page and the main process, then `scripts/package.ts` runs electron-builder into `release/tether/`: a deb and an rpm on Linux, a dmg on macOS, and an NSIS installer on Windows. Build each platform's bundles on that platform. Add `-- --dir` to stop at the unpacked app. Assembling the Linux packages needs `rpmbuild`, and electron-builder's bundled fpm needs `libcrypt.so.1`, which Fedora ships as `libxcrypt-compat`.

## Preview builds

A preview is a separate app. `src/main/identity.ts` gives it its own product name, app id, and executable name, so it installs beside a release build and keeps its own settings directory, autostart entry, and single-instance lock. Its icons are blue rather than orange.

```sh
vp build && vp pack && node scripts/package.ts --preview --dir
```

Only a preview build reads `TETHER_POWER_SUPPLY`, which replaces the Linux sysfs directory with a stand-in battery for verification.

## Releases

Push a `v<version>` tag matching `version` in `package.json`, and `.github/workflows/release.yml` builds the bundles on Linux, macOS, and Windows and attaches them to a draft GitHub release. Running the workflow by hand without **publish** is a dry run that keeps the bundles as workflow artifacts. The app does not update itself.

macOS builds are ad-hoc signed rather than signed with an Apple Developer ID, so the first launch of a downloaded dmg needs **Open** from the app's context menu, or `xattr -dr com.apple.quarantine /Applications/Tether.app`.
