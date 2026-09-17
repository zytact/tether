# Shared paths for the verify-tether helpers. Sourced, not run.
SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO="$(cd "$SKILL_DIR/../../.." && pwd)"
BIN="$REPO/release/tether-preview/linux-unpacked/tether-preview"
# Harness state: PIDs, the fake battery, and the scratch home. Cleanup removes it.
RUN_DIR="/tmp/tether-verify"
POWER_SUPPLY="$RUN_DIR/power_supply"
SCRATCH_HOME="$RUN_DIR/home"
# Proof artifacts. Cleanup never touches them.
EVIDENCE_ROOT="$REPO/verification-evidence"

# True when the PID in $1's file is alive and runs the executable $2.
owned_alive() {
  local pid
  pid="$(cat "$1" 2>/dev/null || true)"
  [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null && [ "$(readlink -f "/proc/$pid/exe" 2>/dev/null)" = "$(readlink -f "$2")" ]
}
