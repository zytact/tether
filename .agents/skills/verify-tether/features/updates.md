# Updates

A release build reads `latest.json` from the latest GitHub release at launch and every 6 hours. Failed checks retry after 5 minutes, doubling up to that interval. A newer compatible release puts `Version <x> is available.` under the `Version` row and `Update to v<x>` on the tray menu, which opens the window. `Check for updates` runs the same check and says `v<current> is the latest version.` when there is nothing newer.

Applicable release notices appear under `Before you update`. `Install update` stays disabled until `I have read these notices` is checked. A release whose `minimumVersion` is newer than the installed version instead asks for a fresh install and offers `Open latest release`.

`What's new` opens a dialog with releases newer than the running version, grouped as New, Fixed, and Changed. Notes come from GitHub's release API, separately from the manifest. An empty list says `No release notes were published.`; a failed request says `Could not load the release notes.`. `Back` closes the dialog, whose footer also holds the notices and install control.

Install downloads the bundle for the installed format and shows download progress, then checks its Ed25519 signature against the key in `src/main/release.ts`. Only a valid download reaches installation and relaunch. A failure shows an alert and keeps the release on offer. Preview builds never check unless `TETHER_UPDATE_MANIFEST` points at a stand-in manifest.

## Sub-features

- The background check, banner, tray item, and manual check.
- Notice acknowledgement and fresh-install requirements.
- What's new, its loading, empty, error, and grouped release states.
- Download progress and signature rejection.
- The preview refusing to check without a stand-in manifest.

## How to get to it (user POV)

The `Version` row at the bottom of the window, and the tray menu.

## Driving it with the harness

Use one shell for this recipe so the trap owns the server and temporary package marker. Start with a running, healthy preview from the skill's Launch section. Needs `jq`. The fixture serves `latest.json` and a slow unsigned download on a free loopback port, so progress is visible and installation stops before `pkexec`.

```sh
set -e
M=$(mktemp -d "$PWD/$EVIDENCE/update-fixture.XXXXXX")
marker=release/tether-preview/linux-unpacked/resources/package-type
test ! -e "$marker"
current=$(node -p "require('./package.json').version")
server_pid=
finish_updates() {
  $S/collect.sh "$EVIDENCE/updates" || true
  $S/cleanup.sh
  if [ -n "$server_pid" ]; then
    kill "$server_pid" 2>/dev/null || true
    wait "$server_pid" 2>/dev/null || true
  fi
  rm -f "$marker"
}
trap finish_updates EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
echo rpm > "$marker"
$S/update-server.py "$M" > "$M/server.log" 2>&1 &
server_pid=$!
for _ in $(seq 1 30); do test -s "$M/server.url" && break; sleep 0.1; done
url=$(cat "$M/server.url")
jq -n --arg url "$url/tether.rpm" --arg current "$current" \
  '{version:"9.9.9",notices:[{id:"verify",message:"Read this preview notice.",fromVersion:$current,throughVersion:$current,platforms:["linux"]}],platforms:{"linux-x86_64-rpm":{url:$url,signature:"AAAA"}}}' > "$M/latest.json"
curl -fsS "$url/latest.json" > /dev/null
TETHER_UPDATE_MANIFEST="$url/latest.json" $S/launch.sh --restart
$S/doctor.sh
node $S/drive.ts snapshot
$S/tray.sh layout
node $S/drive.ts screenshot "$EVIDENCE" update-notice
node $S/drive.ts click button "What's new"
node $S/drive.ts wait-hidden "Loading release notes"
node $S/drive.ts snapshot
node $S/drive.ts screenshot "$EVIDENCE" release-notes
node $S/drive.ts click button Back
node $S/drive.ts click checkbox "I have read these notices"
node $S/drive.ts click button "Install update"
node $S/drive.ts snapshot
node $S/drive.ts screenshot "$EVIDENCE" update-progress
sleep 17
node $S/drive.ts snapshot
node $S/drive.ts screenshot "$EVIDENCE" signature-rejected
jq '.minimumVersion="9.0.0"' "$M/latest.json" > "$M/next.json"
mv "$M/next.json" "$M/latest.json"
node $S/drive.ts click button "Check for updates"
sleep 2
node $S/drive.ts screenshot "$EVIDENCE" fresh-install-required
jq -n --arg current "$current" '{version:$current,platforms:{}}' > "$M/latest.json"
node $S/drive.ts click button "Check for updates"
sleep 2
node $S/drive.ts snapshot
env -u TETHER_UPDATE_MANIFEST $S/launch.sh --restart
$S/doctor.sh
node $S/drive.ts click button "Check for updates"
sleep 2
node $S/drive.ts snapshot
```

Proof: the initial banner and tray offer v9.9.9, with installation disabled until acknowledgement. The dialog loads a notes result independently of the fixture. During the slow download, `Installing update` contains `Update progress`; afterwards, the signature-failure alert leaves the update available. `minimumVersion` replaces installation with fresh-install instructions. The current-version manifest reports latest, and the final restart refuses preview updates. The trap collects evidence and stops the preview and fixture server, leaving the evidence directory intact.

## Gotchas

- Never serve a bundle signed with the real release key. Successful installation and relaunch require an authentic bundle and would modify the installed app; this isolated pass deliberately stops at signature rejection.
- A newer release without a matching platform download produces a check error unless its minimum version requires a fresh install.
- `TETHER_UPDATE_MANIFEST` overrides only the manifest. Grouped notes require newer published releases on GitHub; a synthetic future version may return the empty state. Record the actual result, including a network or API failure.
- Each restart inherits the command's environment. Explicitly unset an exported manifest when proving preview refusal.
- `cleanup.sh` owns the preview processes. The recipe's trap separately owns its server and temporary marker.
