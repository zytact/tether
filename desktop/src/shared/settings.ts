export const urgencies = ["low", "normal", "critical"] as const;
export type Urgency = (typeof urgencies)[number];

/** Everything a person can change about the alerts. Every change applies to the running monitor at once. */
export type Settings = {
  above: number;
  below: number;
  aboveEnabled: boolean;
  belowEnabled: boolean;
  /** Played with each alert. Null leaves the notification's own sound to the operating system. */
  soundPath: string | null;
  /** Notification urgency, which only Linux notification servers read. */
  urgency: Urgency;
  intervalSeconds: number;
  notifyAttempts: number;
};

export type SettingKey = keyof Settings;

export const defaultSettings: Settings = {
  above: 85,
  below: 20,
  aboveEnabled: true,
  belowEnabled: true,
  soundPath: null,
  urgency: "normal",
  intervalSeconds: 120,
  notifyAttempts: 15,
};

/** The whole-number settings and the range each accepts. An interval of at most a day keeps the poll timer
 * well inside what `setTimeout` can hold. */
export const numberRanges = {
  above: { min: 0, max: 100 },
  below: { min: 0, max: 100 },
  intervalSeconds: { min: 1, max: 86_400 },
  notifyAttempts: { min: 1, max: Number.MAX_SAFE_INTEGER },
} satisfies Partial<Record<SettingKey, { min: number; max: number }>>;

const inRange =
  ({ min, max }: { min: number; max: number }) =>
  (value: unknown): value is number =>
    typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;

/** Accepts only a value the setting can hold. The main process checks every change and every loaded
 * field against these. */
export const settingRules: { [K in SettingKey]: (value: unknown) => value is Settings[K] } = {
  above: inRange(numberRanges.above),
  below: inRange(numberRanges.below),
  aboveEnabled: (value) => typeof value === "boolean",
  belowEnabled: (value) => typeof value === "boolean",
  soundPath: (value): value is string | null => value === null || (typeof value === "string" && value !== ""),
  urgency: (value): value is Urgency => urgencies.some((urgency) => urgency === value),
  intervalSeconds: inRange(numberRanges.intervalSeconds),
  notifyAttempts: inRange(numberRanges.notifyAttempts),
};
