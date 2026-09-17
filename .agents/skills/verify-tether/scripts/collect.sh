#!/usr/bin/env bash
# Copy the run's recordings into an evidence directory and parse them. Safe to run repeatedly while the
# preview runs; each call reflects everything recorded since launch.
# Usage: collect.sh <evidence-dir>
set -euo pipefail
. "$(dirname "$0")/common.sh"
out="${1:?usage: collect.sh <evidence-dir>}"
mkdir -p "$out"
for file in notifications.raw audio-sinks.raw battery-timeline.log preview.log; do
  [ -f "$RUN_DIR/$file" ] && cp "$RUN_DIR/$file" "$out/"
done
[ -f "$SCRATCH_HOME/config/dev.arnab.tether.preview/settings.json" ] &&
  cp "$SCRATCH_HOME/config/dev.arnab.tether.preview/settings.json" "$out/settings.json"

# One line per Notify call addressed to the notification server. The server forwards each call to the shell,
# and those copies come from the server itself. Only the first four strings of a call are its app name, icon,
# summary and body; the actions and hints that follow carry strings too.
server="$(dbus-send --session --print-reply --dest=org.freedesktop.DBus / org.freedesktop.DBus.GetNameOwner \
  string:org.freedesktop.Notifications | awk '/string/ { gsub(/"/, "", $2); print $2 }')"
awk -v server="destination=$server " '
  function emit() { if (want) printf "app=%s | summary=%s | body=%s | urgency=%s\n", f[1], f[3], f[4], urg; want = 0 }
  /^(method call|signal|method return|error)/ { emit(); want = (/^method call/ && /member=Notify/ && index($0, server)); n = 0; urg = "-"; next }
  want && n < 4 && /^   string "/ { n++; line = $0; sub(/^   string "/, "", line); sub(/"$/, "", line); f[n] = line; next }
  want && /string "urgency"/ { getline; urg = $NF; next }
  END { emit() }
' "$out/notifications.raw" | grep '^app=Tether Preview' >"$out/notifications.txt" || true

# Chromium names its audio stream after the executable and ignores PULSE_PROP. Its audio service keeps one
# stream open across plays, so this proves playback happened, not how many sounds played.
awk '
  /^@ / { at = $2 }
  /Sink Input #/ { id = $3 }
  /application.process.binary = "tether-preview"/ { if (!(id in first)) first[id] = at; last[id] = at }
  END { for (id in first) print id, "from", first[id], "to", last[id] }
' "$out/audio-sinks.raw" | sort >"$out/audio-streams.txt"

{
  echo "notifications: $(wc -l <"$out/notifications.txt")"
  sort "$out/notifications.txt" | uniq -c | sed 's/^/  /'
  echo "tether-preview audio streams: $(wc -l <"$out/audio-streams.txt")"
  sed 's/^/  /' "$out/audio-streams.txt"
  echo "sound errors in preview.log: $(grep -c 'Failed to play\|Skipped the alert sound' "$out/preview.log" 2>/dev/null || true)"
  echo "battery read errors in preview.log: $(grep -c 'Failed to read the battery' "$out/preview.log" 2>/dev/null || true)"
} | tee "$out/summary.txt"
echo "evidence: $out"
