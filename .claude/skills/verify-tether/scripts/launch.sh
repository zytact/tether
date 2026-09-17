#!/usr/bin/env bash
# Launch the built preview on an isolated Xvfb display, with a scratch config home, a fake battery, a
# D-Bus notification recorder, and an audio stream recorder. DevTools opens for drive.ts.
#   launch.sh [--real-battery] [--settings JSON]   fresh launch; --settings seeds settings.json
#   launch.sh --restart                            relaunch only the preview, keeping settings and recorders
set -euo pipefail
. "$(dirname "$0")/common.sh"
MODE=fake
RESTART=0
SEED=""
while [ $# -gt 0 ]; do
  case "$1" in
    --real-battery) MODE=real; shift ;;
    --restart) RESTART=1; MODE="$(cat "$RUN_DIR/run.mode" 2>/dev/null || echo fake)"; shift ;;
    --settings) SEED="$2"; shift 2 ;;
    *) echo "usage: launch.sh [--real-battery] [--settings JSON] | --restart" >&2; exit 2 ;;
  esac
done
XVFB="${TETHER_XVFB:-$(command -v Xvfb || true)}"
[ -x "$BIN" ] || { echo "Preview binary missing. Run build-preview.sh first." >&2; exit 1; }
[ -x "$XVFB" ] || { echo "Xvfb is required. Install it or set TETHER_XVFB." >&2; exit 1; }
for tool in dbus-monitor pactl xprop curl python3; do
  command -v "$tool" >/dev/null || { echo "$tool is required." >&2; exit 1; }
done

if [ "$RESTART" = 1 ]; then
  [ -s "$RUN_DIR/run.display" ] || { echo "Nothing to restart. Run launch.sh first." >&2; exit 1; }
  if owned_alive "$RUN_DIR/run.pid" "$BIN"; then
    kill "$(cat "$RUN_DIR/run.pid")"
    for _ in $(seq 1 10); do owned_alive "$RUN_DIR/run.pid" "$BIN" || break; sleep 1; done
    owned_alive "$RUN_DIR/run.pid" "$BIN" && { echo "The preview did not quit. Run cleanup.sh." >&2; exit 1; }
  fi
  display="$(cat "$RUN_DIR/run.display")"
else
  if owned_alive "$RUN_DIR/run.pid" "$BIN"; then
    echo "Refusing: a preview from this harness is still running. Run cleanup.sh first." >&2
    exit 1
  fi
  rm -rf "$RUN_DIR"
  mkdir -p "$RUN_DIR" "$SCRATCH_HOME/config"
  display=""
  for candidate in $(seq 90 110); do
    [ -e "/tmp/.X11-unix/X$candidate" ] || { display=":$candidate"; break; }
  done
  [ -n "$display" ] || { echo "No free virtual display from :90 to :110." >&2; exit 1; }
  setsid "$XVFB" "$display" -screen 0 800x900x24 -nolisten tcp >"$RUN_DIR/xvfb.log" 2>&1 &
  echo $! >"$RUN_DIR/xvfb.pid"
  readlink -f "$XVFB" >"$RUN_DIR/xvfb.exe"
  echo "$display" >"$RUN_DIR/run.display"
  for _ in $(seq 1 30); do
    DISPLAY="$display" xprop -root >/dev/null 2>&1 && break
    sleep 0.5
  done

  # Only calls to the notification server are recorded; the server's own re-emits are filtered at parse time.
  setsid dbus-monitor --session "interface='org.freedesktop.Notifications',member='Notify'" \
    >"$RUN_DIR/notifications.raw" 2>&1 &
  echo $! >"$RUN_DIR/dbus-monitor.pid"
  readlink -f "$(command -v dbus-monitor)" >"$RUN_DIR/dbus-monitor.exe"
  setsid bash -c 'while :; do date +"@ %H:%M:%S.%N"; pactl list sink-inputs 2>/dev/null; sleep 0.2; done' \
    >"$RUN_DIR/audio-sinks.raw" 2>&1 &
  echo $! >"$RUN_DIR/audio-poller.pid"
  readlink -f "$(command -v bash)" >"$RUN_DIR/audio-poller.exe"

  [ "$MODE" = fake ] && "$SKILL_DIR/scripts/battery.sh" Discharging 50 >/dev/null
  if [ -n "$SEED" ]; then
    mkdir -p "$SCRATCH_HOME/config/dev.arnab.tether.preview"
    printf '%s\n' "$SEED" >"$SCRATCH_HOME/config/dev.arnab.tether.preview/settings.json"
  fi
fi

echo "$MODE" >"$RUN_DIR/run.mode"
cdp_port="$(python3 -c 'import socket; s = socket.socket(); s.bind(("127.0.0.1", 0)); print(s.getsockname()[1])')"
echo "$cdp_port" >"$RUN_DIR/run.cdp"
# A shell inside another Electron app can carry ELECTRON_RUN_AS_NODE, which starts a bare Node instead.
preview_env=(env -u ELECTRON_RUN_AS_NODE -u TETHER_POWER_SUPPLY DISPLAY="$display"
  XDG_CONFIG_HOME="$SCRATCH_HOME/config")
[ "$MODE" = fake ] && preview_env+=(TETHER_POWER_SUPPLY="$POWER_SUPPLY")

"${preview_env[@]}" setsid "$BIN" --ozone-platform=x11 --remote-debugging-port="$cdp_port" </dev/null \
  >>"$RUN_DIR/preview.log" 2>&1 &
preview_pid=$!
echo "$preview_pid" >"$RUN_DIR/run.pid"
echo "$(date +%H:%M:%S) launched preview pid $preview_pid ($MODE battery)" >>"$RUN_DIR/battery-timeline.log"

for _ in $(seq 1 30); do
  kill -0 "$preview_pid" 2>/dev/null || { echo "Preview exited early. Log tail:" >&2; tail -n 20 "$RUN_DIR/preview.log" >&2; exit 1; }
  if curl -fsS "http://127.0.0.1:$cdp_port/json/list" 2>/dev/null | grep -q '"type": "page"'; then
    echo "Ready: Tether Preview ($MODE battery) on display $display (pid $preview_pid, DevTools port $cdp_port)"
    exit 0
  fi
  sleep 1
done
echo "Timed out waiting for the preview window." >&2
exit 1
