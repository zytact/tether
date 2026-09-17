#!/usr/bin/env bash
# Stop only the processes launch.sh started, then remove harness state. Evidence under
# verification-evidence/ is never touched.
set -u
. "$(dirname "$0")/common.sh"

stop_owned() {
  local label="$1" pid_file="$2" exe="$3" pid
  [ -f "$pid_file" ] || return 0
  pid="$(cat "$pid_file")"
  if owned_alive "$pid_file" "$exe"; then
    echo "Stopping $label pid $pid"
    kill "$pid" 2>/dev/null || true
    for _ in $(seq 1 5); do kill -0 "$pid" 2>/dev/null || break; sleep 1; done
    kill -0 "$pid" 2>/dev/null && kill -9 "$pid" 2>/dev/null
  else
    echo "Recorded $label pid $pid is gone or foreign; leaving it alone."
  fi
}

stop_owned preview "$RUN_DIR/run.pid" "$BIN"
stop_owned "notification recorder" "$RUN_DIR/dbus-monitor.pid" "$(cat "$RUN_DIR/dbus-monitor.exe" 2>/dev/null)"
stop_owned "audio recorder" "$RUN_DIR/audio-poller.pid" "$(cat "$RUN_DIR/audio-poller.exe" 2>/dev/null)"
stop_owned Xvfb "$RUN_DIR/xvfb.pid" "$(cat "$RUN_DIR/xvfb.exe" 2>/dev/null)"
rm -rf "$RUN_DIR"
echo "CLEANUP: done (evidence under $EVIDENCE_ROOT preserved)"
