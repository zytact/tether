#!/usr/bin/env bash
# Read or click the running preview's tray menu. Electron publishes it on the session bus as a
# StatusNotifierItem, which works under Xvfb because the bus is the real session's. It needs the desktop's
# tray host (a StatusNotifierWatcher) running when the preview launches.
#   tray.sh layout            print each item as ID<TAB>enabled<TAB>label
#   tray.sh click <label>     click the item with exactly this label
set -euo pipefail
. "$(dirname "$0")/common.sh"
owned_alive "$RUN_DIR/run.pid" "$BIN" || { echo "No harness preview is running." >&2; exit 1; }
dbus-send --session --print-reply --dest=org.freedesktop.DBus / org.freedesktop.DBus.NameHasOwner \
  string:org.kde.StatusNotifierWatcher 2>/dev/null | grep -q 'boolean true' || {
  echo "No StatusNotifierWatcher on the session bus, so the preview has no tray menu to read." >&2
  exit 1
}
dest="org.freedesktop.StatusNotifierItem-$(cat "$RUN_DIR/run.pid")-1"

layout() {
  gdbus call --session --dest "$dest" --object-path /org/chromium/DbusMenu \
    --method com.canonical.dbusmenu.GetLayout -- 0 -1 '["label","enabled"]' |
    python3 -c '
import re, sys
for id, props in re.findall(r"<\((\d+), (@a\{sv\} \{\}|\{[^}]*\})", sys.stdin.read()):
    label = re.search(r"'"'"'label'"'"': <'"'"'(.*?)'"'"'>", props)
    enabled = "false" if "<false>" in props else "true"
    print(id, enabled, label.group(1) if label else "---", sep="\t")
'
}

case "${1:-}" in
  layout) layout ;;
  click)
    label="${2:?usage: tray.sh click <label>}"
    id="$(layout | awk -F '\t' -v label="$label" '$3 == label { print $1; exit }')"
    [ -n "$id" ] || { echo "No tray item labelled \"$label\"." >&2; exit 1; }
    gdbus call --session --dest "$dest" --object-path /org/chromium/DbusMenu \
      --method com.canonical.dbusmenu.Event -- "$id" clicked '<"">' 0 >/dev/null
    echo "CLICKED tray \"$label\""
    ;;
  *) echo "usage: tray.sh <layout | click LABEL>" >&2; exit 2 ;;
esac
