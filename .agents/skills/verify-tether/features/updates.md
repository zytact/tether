# Updates

A release build reads `latest.json` from the latest GitHub release at launch and every 6 hours. A newer release puts `Version <x> is available.` with `Install update` under the `Version` row, and `Update to v<x>` on the tray menu, which opens the window. `Check for updates` runs the same check and says `v<current> is the latest version.` when there is nothing newer. Install downloads the bundle for the installed format, checks its Ed25519 signature against the key in `src/main/release.ts`, installs it, and relaunches. A failure shows an alert and keeps the release on offer.

Preview builds never check, unless `TETHER_UPDATE_MANIFEST` points them at a stand-in manifest.

## Sub-features

- The background check at launch, the banner, and the tray item.
- `Check for updates`, with and without a newer release.
- Refusing a download whose signature does not match.
- The preview refusing to check without a stand-in manifest.

## How to get to it (user POV)

The `Version` row at the bottom of the window, and the tray menu.

## Driving it with the harness

The unpacked preview has no package format, so the updater cannot pick a download until you mark one. Serve a manifest whose bundle fails its signature, so the install stops before `pkexec`:

```sh
echo rpm > release/tether-preview/linux-unpacked/resources/package-type
M=/tmp/tether-update-server && mkdir -p $M && echo tampered > $M/tether.rpm
jq -n '{version:"9.9.9",platforms:{"linux-x86_64-rpm":{url:"http://127.0.0.1:8765/tether.rpm",signature:"AAAA"}}}' > $M/latest.json
(cd $M && setsid python3 -m http.server 8765 --bind 127.0.0.1 >/dev/null 2>&1 &)
TETHER_UPDATE_MANIFEST=http://127.0.0.1:8765/latest.json $S/launch.sh
sleep 3 && node $S/drive.ts snapshot | tail -6 && $S/tray.sh layout
node $S/drive.ts click button "Install update" && sleep 3 && node $S/drive.ts snapshot | tail -3
jq -n '{version:"3.0.0",platforms:{}}' > $M/latest.json   # use the version in package.json
TETHER_UPDATE_MANIFEST=http://127.0.0.1:8765/latest.json $S/launch.sh --restart
node $S/drive.ts click button "Check for updates" && sleep 2 && node $S/drive.ts snapshot | tail -3
$S/launch.sh --restart && node $S/drive.ts click button "Check for updates" && sleep 2 && node $S/drive.ts snapshot | tail -3
```

Proof: the `Update available` region and `Update to v9.9.9` on the tray before any click; the alert `Could not install the update: the download failed its signature check` with the region still there; `is the latest version.` against the current manifest; `dev and preview builds never update` once the variable is gone. Screenshot each state.

## Gotchas

- Never serve a bundle signed with the real release key. The install would reach `pkexec` and prompt for a password on the user's desktop.
- `launch.sh --restart` keeps the variable only if you set it again on that command.
- Stop the HTTP server after cleanup. `cleanup.sh` does not know about it.
