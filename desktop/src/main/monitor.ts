import type { BatteryCheck, BatteryReading } from "../shared/battery";
import type { Settings } from "../shared/settings";
import { crossedThreshold, nextAlert, settingsChanged } from "./alerts";
import type { AlertSession } from "./alerts";

export type MonitorEffects = {
  readBattery: () => Promise<BatteryReading>;
  alert: (reading: BatteryReading, settings: Settings) => void;
  checked: (check: BatteryCheck) => void;
};

/** Checks the battery every `intervalSeconds` and alerts while it sits past a threshold. A check judges its
 * reading against the settings current when the reading lands, so a check asked for while one is reading is
 * already covered and does not run. */
export class Monitor {
  private session: AlertSession = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private checking = false;

  constructor(
    private current: Settings,
    private readonly effects: MonitorEffects,
  ) {}

  get settings(): Settings {
    return this.current;
  }

  start() {
    this.check();
  }

  update(next: Settings) {
    const { session, effect } = settingsChanged(this.session, this.current, next);
    this.session = session;
    this.current = next;
    if (effect === "evaluate") this.check();
    else if (effect === "reschedule") this.schedule();
  }

  private check() {
    clearTimeout(this.timer);
    if (this.checking) return;
    this.checking = true;
    void this.effects
      .readBattery()
      .then(
        (reading) => {
          const { session, alert } = nextAlert(
            this.session,
            crossedThreshold(this.current, reading),
            this.current.notifyAttempts,
          );
          this.session = session;
          this.effects.checked({ ok: true, reading, checkedAt: Date.now() });
          if (alert) this.effects.alert(reading, this.current);
        },
        (error: unknown) => {
          console.error("Failed to read the battery:", error);
          const message = error instanceof Error ? error.message : String(error);
          this.effects.checked({ ok: false, error: message, checkedAt: Date.now() });
        },
      )
      .finally(() => {
        this.checking = false;
        this.schedule();
      });
  }

  private schedule() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.check(), this.current.intervalSeconds * 1000);
  }
}
