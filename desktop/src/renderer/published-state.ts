import { useEffect, useState } from "react";
import type { Events } from "../shared/ipc";

/** State the main process publishes as `event` and also serves as its current value. The listener is
 * attached before the read, since the main process can publish while the page is still loading and a
 * value landing between the two would otherwise be lost until the next publish. `failed` means the
 * read failed and nothing has been published since. */
export function usePublishedState<E extends keyof Events>(event: E) {
  const [value, setValue] = useState<Events[E] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let mounted = true;
    const stop = window.rustcharge.on(event, (published) => {
      if (mounted) {
        setValue(published);
        setFailed(false);
      }
    });
    void window.rustcharge.current(event).then(
      (read) => {
        if (mounted) setValue((current) => current ?? read);
      },
      () => {
        if (mounted) setFailed(true);
      },
    );
    return () => {
      mounted = false;
      stop();
    };
  }, [event]);

  return [value, setValue, failed] as const;
}
