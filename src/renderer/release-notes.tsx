import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { version } from "../../package.json";
import type { ReleaseChange, ReleaseNotes } from "../shared/ipc";
import { PendingLabel } from "./busy";
import type { Loadable } from "./busy";

const kindLabels = { new: "New", fixed: "Fixed", changed: "Changed" } satisfies Record<ReleaseChange["kind"], string>;
const kindOrder: ReleaseChange["kind"][] = ["new", "fixed", "changed"];

export function ReleaseNotesPage({
  target,
  onClose,
  footer,
}: {
  target: string;
  onClose: () => void;
  footer: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [releases, setReleases] = useState<Loadable<ReleaseNotes[]>>("loading");

  useEffect(() => {
    dialog.current?.showModal();
    window.tether.invoke("releaseNotes").then(setReleases, () => setReleases("unavailable"));
  }, []);

  return (
    <dialog ref={dialog} className="release-notes" aria-labelledby="release-notes-title" onClose={onClose}>
      <div className="release-notes-body">
        <header>
          <div>
            <h1 id="release-notes-title">What's new</h1>
            <p className="status">
              v{version} to v{target}
            </p>
          </div>
          <button onClick={() => dialog.current?.close()}>Back</button>
        </header>
        {typeof releases === "string" ? (
          <PendingLabel
            className="empty release-notes-state"
            failed={releases === "unavailable"}
            failedLabel="Could not load the release notes."
            pendingLabel="Loading release notes"
          />
        ) : releases.length === 0 ? (
          <p className="empty">No release notes were published.</p>
        ) : (
          releases.map((release) => <Release key={release.version} release={release} />)
        )}
      </div>
      <div className="release-notes-footer">{footer}</div>
    </dialog>
  );
}

function Release({ release }: { release: ReleaseNotes }) {
  const groups = kindOrder
    .map((kind) => ({ label: kindLabels[kind], changes: release.changes.filter((change) => change.kind === kind) }))
    .filter(({ changes }) => changes.length > 0);
  return (
    <section className="release" aria-label={`Version ${release.version}`}>
      <div className="entry-head">
        <h2 className="figure">v{release.version}</h2>
        {release.publishedAt && (
          <span className="release-date">
            {new Date(release.publishedAt).toLocaleDateString(undefined, { dateStyle: "medium" })}
          </span>
        )}
      </div>
      {groups.length === 0 && <p className="empty">No changes listed.</p>}
      {groups.map(({ label, changes }) => (
        <div className="release-group" key={label}>
          <h3>{label}</h3>
          <ol className="credits">
            {changes.map((change, index) => (
              <li key={index}>
                <span>{change.summary}</span>
                {change.scope && <span className="credit-value">{change.scope}</span>}
              </li>
            ))}
          </ol>
        </div>
      ))}
    </section>
  );
}
