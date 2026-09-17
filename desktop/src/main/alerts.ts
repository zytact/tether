import type { BatteryReading } from "../shared/battery";
import type { Settings } from "../shared/settings";

export type Threshold = "above" | "below";

/** The alerts for the threshold the battery sits past. A session that has sent `notifyAttempts` alerts stays
 * quiet until the battery leaves that threshold, so crossing it again starts a new one. */
export type AlertSession = { threshold: Threshold; sent: number } | null;

/** Charging at or above `above` crosses the high threshold, and discharging at or below `below` the low one.
 * Each needs the opposite charging state, so a reading crosses at most one. */
export function crossedThreshold(settings: Settings, { percent, charging }: BatteryReading): Threshold | null {
  if (charging) return settings.aboveEnabled && percent >= settings.above ? "above" : null;
  return settings.belowEnabled && percent <= settings.below ? "below" : null;
}

/** Moves the session on for a new reading, and says whether that reading sends an alert. */
export function nextAlert(
  session: AlertSession,
  crossed: Threshold | null,
  notifyAttempts: number,
): { session: AlertSession; alert: boolean } {
  if (crossed === null) return { session: null, alert: false };
  const current = session?.threshold === crossed ? session : { threshold: crossed, sent: 0 };
  if (current.sent >= notifyAttempts) return { session: current, alert: false };
  return { session: { threshold: crossed, sent: current.sent + 1 }, alert: true };
}

/** `evaluate` checks the battery now, `reschedule` starts a new interval from now, and `keep` leaves the next
 * check where it was. */
export type ChangeEffect = "evaluate" | "reschedule" | "keep";

const thresholdSettings = {
  above: ["above", "aboveEnabled"],
  below: ["below", "belowEnabled"],
} as const satisfies Record<Threshold, readonly (keyof Settings)[]>;

/** A changed threshold ends its own session, so the battery is judged against it afresh straight away. While
 * the other threshold has a session the check is skipped: the battery cannot cross both, and checking early
 * would only send that session an extra alert. Sound, urgency and attempt changes keep the session's count. */
export function settingsChanged(
  session: AlertSession,
  previous: Settings,
  next: Settings,
): { session: AlertSession; effect: ChangeEffect } {
  const changed = (["above", "below"] as const).filter((threshold) =>
    thresholdSettings[threshold].some((key) => previous[key] !== next[key]),
  );
  if (changed.length > 0) {
    if (session === null || changed.includes(session.threshold)) return { session: null, effect: "evaluate" };
    return { session, effect: "keep" };
  }
  return { session, effect: previous.intervalSeconds === next.intervalSeconds ? "keep" : "reschedule" };
}
