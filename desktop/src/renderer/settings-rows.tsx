import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { numberRanges, urgencies } from "../shared/settings";
import type { Settings, Urgency } from "../shared/settings";
import { PendingLabel, useVisiblePending } from "./busy";
import type { Loadable } from "./busy";

/** The switch every settings row uses. It ignores clicks while `busy`, and dims and says so only
 * while the pending state is visible. */
function Toggle({
  label,
  checked,
  busy = false,
  onToggle,
}: {
  label: string;
  checked: boolean;
  busy?: boolean;
  onToggle: () => void;
}) {
  const saving = useVisiblePending(busy);
  const toggle = () => {
    if (!busy) onToggle();
  };
  return (
    <button
      className="setting-toggle"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-busy={saving}
      disabled={saving}
      onClick={toggle}
    >
      <span className="setting-state">{saving ? "Saving" : checked ? "On" : "Off"}</span>
      <span className="switch-track" aria-hidden="true">
        <span className="switch-knob" />
      </span>
    </button>
  );
}

function Row({ title, description, control }: { title: string; description: ReactNode; control: ReactNode }) {
  return (
    <section className="setting-row">
      <div className="setting-copy">
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {control}
    </section>
  );
}

function Notice({ message }: { message: string | null }) {
  return (
    message && (
      <p className="notice settings-notice" role="alert">
        {message}
      </p>
    )
  );
}

type NumberKey = keyof typeof numberRanges;

/** Commits on Enter or when focus leaves, and puts the saved value back when the entry is out of range. */
function NumberInput({
  label,
  unit,
  setting,
  value,
  onCommit,
}: {
  label: string;
  unit: string;
  setting: NumberKey;
  value: number;
  onCommit: (value: number) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const { min, max } = numberRanges[setting];

  const commit = async () => {
    const entered = Number(draft);
    if (draft.trim() === "" || entered === value || !(await onCommit(entered))) setDraft(String(value));
  };

  return (
    <label className="setting-number">
      <input
        type="number"
        inputMode="numeric"
        aria-label={label}
        min={min}
        max={max}
        step={1}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
      />
      <span>{unit}</span>
    </label>
  );
}

const urgencyNames = { low: "Low", normal: "Normal", critical: "Critical" } satisfies Record<Urgency, string>;

/** Read once on mount, since only this window changes the settings. */
export function AlertSettings() {
  const [settings, setSettings] = useState<Loadable<Settings>>("loading");

  useEffect(() => {
    let mounted = true;
    void window.rustcharge.invoke("settings").then(
      (read) => {
        if (mounted) setSettings(read);
      },
      () => {
        if (mounted) setSettings("unavailable");
      },
    );
    return () => {
      mounted = false;
    };
  }, []);

  if (settings === "unavailable") return <Notice message="Could not load settings." />;
  if (settings === "loading") return null;
  return <AlertRows settings={settings} onChange={setSettings} />;
}

/** Every change saves at once and applies to the running monitor. */
function AlertRows({ settings, onChange }: { settings: Settings; onChange: (settings: Settings) => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = async (change: Partial<Settings>) => {
    setSaving(true);
    setError(null);
    try {
      onChange(await window.rustcharge.invoke("updateSettings", change));
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save the setting.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const updateNumber = (setting: NumberKey) => (value: number) => {
    const { min, max } = numberRanges[setting];
    if (Number.isInteger(value) && value >= min && value <= max) return update({ [setting]: value });
    setError(`Enter a whole number from ${min} to ${max}.`);
    return Promise.resolve(false);
  };

  const chooseSound = async () => {
    setError(null);
    try {
      const path = await window.rustcharge.invoke("chooseSound");
      if (path !== null) await update({ soundPath: path });
    } catch {
      setError("Could not open the file chooser.");
    }
  };

  return (
    <>
      <Row
        title="High battery"
        description="Alert while charging at or above this level."
        control={
          <div className="setting-actions">
            <NumberInput
              label="High battery level"
              unit="%"
              setting="above"
              value={settings.above}
              onCommit={updateNumber("above")}
            />
            <Toggle
              label="High battery alerts"
              checked={settings.aboveEnabled}
              busy={saving}
              onToggle={() => void update({ aboveEnabled: !settings.aboveEnabled })}
            />
          </div>
        }
      />
      <Row
        title="Low battery"
        description="Alert while discharging at or below this level."
        control={
          <div className="setting-actions">
            <NumberInput
              label="Low battery level"
              unit="%"
              setting="below"
              value={settings.below}
              onCommit={updateNumber("below")}
            />
            <Toggle
              label="Low battery alerts"
              checked={settings.belowEnabled}
              busy={saving}
              onToggle={() => void update({ belowEnabled: !settings.belowEnabled })}
            />
          </div>
        }
      />
      <Row
        title="Alerts per crossing"
        description="Alerts stop after this many until the battery leaves the level and crosses it again."
        control={
          <NumberInput
            label="Alerts per crossing"
            unit="alerts"
            setting="notifyAttempts"
            value={settings.notifyAttempts}
            onCommit={updateNumber("notifyAttempts")}
          />
        }
      />
      <Row
        title="Check every"
        description="How often the battery is read."
        control={
          <NumberInput
            label="Check every"
            unit="sec"
            setting="intervalSeconds"
            value={settings.intervalSeconds}
            onCommit={updateNumber("intervalSeconds")}
          />
        }
      />
      <Row
        title="Sound"
        description={
          settings.soundPath === null ? (
            "The system notification sound."
          ) : (
            <span title={settings.soundPath}>{settings.soundPath.split(/[\\/]/).at(-1)}</span>
          )
        }
        control={
          <div className="setting-actions">
            {settings.soundPath !== null && (
              <button disabled={saving} onClick={() => void update({ soundPath: null })}>
                Clear
              </button>
            )}
            <button disabled={saving} onClick={() => void chooseSound()}>
              Choose
            </button>
          </div>
        }
      />
      {window.rustcharge.platform === "linux" && (
        <Row
          title="Urgency"
          description="Critical notifications stay on screen until dismissed."
          control={
            <select
              aria-label="Urgency"
              value={settings.urgency}
              disabled={saving}
              onChange={(event) => {
                const urgency = urgencies.find((value) => value === event.target.value);
                if (urgency) void update({ urgency });
              }}
            >
              {urgencies.map((urgency) => (
                <option key={urgency} value={urgency}>
                  {urgencyNames[urgency]}
                </option>
              ))}
            </select>
          }
        />
      )}
      <Notice message={error} />
    </>
  );
}

/** The registration lives in the operating system, so it is read on every mount rather than cached. */
export function OpenAtLoginRow() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    void window.rustcharge.invoke("openAtLogin").then(
      (read) => {
        if (mounted) setEnabled(read);
      },
      () => {
        if (mounted) setError("Could not read the startup setting.");
      },
    );
    return () => {
      mounted = false;
    };
  }, []);

  const toggle = async (next: boolean) => {
    setSaving(true);
    setError(null);
    try {
      await window.rustcharge.invoke("setOpenAtLogin", next);
      setEnabled(next);
    } catch {
      setError(next ? "Could not turn on opening at login." : "Could not turn off opening at login.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Row
        title="Open at login"
        description="Rustcharge starts in the tray when you sign in, without opening its window."
        control={
          enabled === null ? (
            <PendingLabel
              className="setting-state"
              failed={error !== null}
              failedLabel="Unavailable"
              pendingLabel="Checking"
            />
          ) : (
            <Toggle label="Open at login" checked={enabled} busy={saving} onToggle={() => void toggle(!enabled)} />
          )
        }
      />
      <Notice message={error} />
    </>
  );
}
