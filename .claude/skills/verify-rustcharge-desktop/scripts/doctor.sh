#!/usr/bin/env bash
# Read-only check that the harness-owned preview is worth driving.
set -u
. "$(dirname "$0")/common.sh"
fail=0
ok() { echo "OK $*"; }
bad() { echo "FAIL $*"; fail=1; }

grep -q 'productName: "Rustcharge Preview"' "$DESKTOP/src/main/identity.ts" &&
  grep -q 'appId: "dev.arnab.rustcharge.preview"' "$DESKTOP/src/main/identity.ts" &&
  ok "preview identity is separate from the release" || bad "preview identity config is incomplete"

if [ -x "$BIN" ] && [ -z "$(find "$DESKTOP/src" -newer "$BIN" -print -quit)" ]; then
  ok "preview binary is newer than desktop/src"
else
  bad "preview binary is missing or older than desktop/src; run build-preview.sh"
fi

owned_alive "$RUN_DIR/run.pid" "$BIN" && ok "pid $(cat "$RUN_DIR/run.pid") is the built preview" ||
  bad "preview process is missing or foreign"

display="$(cat "$RUN_DIR/run.display" 2>/dev/null || true)"
owned_alive "$RUN_DIR/xvfb.pid" "$(cat "$RUN_DIR/xvfb.exe" 2>/dev/null)" && DISPLAY="$display" xprop -root >/dev/null 2>&1 &&
  ok "isolated display $display belongs to harness Xvfb" || bad "isolated display is missing or foreign"

cdp="$(cat "$RUN_DIR/run.cdp" 2>/dev/null || true)"
[ -n "$cdp" ] && curl -fsS "http://127.0.0.1:$cdp/json/list" 2>/dev/null | grep -q '"type": "page"' &&
  ok "DevTools port $cdp serves the window" || bad "no window on the DevTools port; open it from the tray or relaunch"

owned_alive "$RUN_DIR/dbus-monitor.pid" "$(cat "$RUN_DIR/dbus-monitor.exe" 2>/dev/null)" &&
  ok "notification recorder is running" || bad "notification recorder is not running"
owned_alive "$RUN_DIR/audio-poller.pid" "$(cat "$RUN_DIR/audio-poller.exe" 2>/dev/null)" &&
  ok "audio recorder is running" || bad "audio recorder is not running"

dbus-send --session --print-reply --dest=org.freedesktop.DBus / org.freedesktop.DBus.NameHasOwner \
  string:org.freedesktop.Notifications 2>/dev/null | grep -q 'boolean true' &&
  ok "a notification server owns org.freedesktop.Notifications" || bad "no notification server on the session bus"

mode="$(cat "$RUN_DIR/run.mode" 2>/dev/null || echo unknown)"
if [ "$mode" = fake ]; then
  [ -f "$POWER_SUPPLY/BAT0/capacity" ] && ok "fake battery: $(cat "$POWER_SUPPLY/BAT0/status") $(cat "$POWER_SUPPLY/BAT0/capacity")%" ||
    bad "fake battery mode but $POWER_SUPPLY is missing"
else
  ok "real battery mode"
fi

[ "$fail" -eq 0 ] && echo "DOCTOR: worth driving" || { echo "DOCTOR: not worth driving"; exit 1; }
