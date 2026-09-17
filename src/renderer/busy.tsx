import { useEffect, useRef, useState } from "react";

/** Work that answers faster than this never shows a pending state, which would only flash. */
const QUICK_ANSWER = 200;
/** Once shown, a pending state stays at least this long, so work ending just past a quick answer
 * does not flash it either. */
const SHORTEST_SHOWING = 400;

/** A value that is still being read, or whose read failed. */
export type Loadable<T> = T | "loading" | "unavailable";

/** Whether to show that `pending` work is running. It turns on only once the work outlasts a quick
 * answer, and then stays on for a readable moment. */
export function useVisiblePending(pending: boolean): boolean {
  const [visible, setVisible] = useState(false);
  const shownAt = useRef(0);
  useEffect(() => {
    if (pending === visible) return;
    const wait = pending ? QUICK_ANSWER : shownAt.current + SHORTEST_SHOWING - performance.now();
    const timer = window.setTimeout(() => {
      shownAt.current = performance.now();
      setVisible(pending);
    }, wait);
    return () => window.clearTimeout(timer);
  }, [pending, visible]);
  return visible;
}

/** A button for work that can answer at once. It ignores clicks while `busy`, and dims and shows
 * `busyLabel` only while the pending state is visible. */
export function BusyButton({
  label,
  busyLabel,
  busy,
  onClick,
}: {
  label: string;
  busyLabel: string;
  busy: boolean;
  onClick: () => void;
}) {
  const visible = useVisiblePending(busy);
  const click = () => {
    if (!busy) onClick();
  };
  return (
    <button onClick={click} disabled={visible} aria-busy={visible}>
      {visible ? busyLabel : label}
    </button>
  );
}

/** Stands in for a value that is not read yet. `pendingLabel` keeps its space but stays hidden until
 * the read is slow, so neither a quick read nor a slow one moves the layout. */
export function PendingLabel({
  failed,
  failedLabel,
  pendingLabel,
  className,
}: {
  failed: boolean;
  failedLabel: string;
  pendingLabel: string;
  className?: string;
}) {
  const visible = useVisiblePending(!failed);
  return (
    <span className={className} data-hidden={!failed && !visible}>
      {failed ? failedLabel : pendingLabel}
    </span>
  );
}
