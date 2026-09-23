import { useState } from "react";
import type { ReactNode } from "react";
import type { AvailableUpdate, InstallProgress, ReleaseNotice } from "../shared/ipc";
import { installStatus } from "./presentation";
import { BusyButton } from "./busy";
import { usePublishedState } from "./published-state";
import { ReleaseNotesPage } from "./release-notes";

export function UpdateNotice() {
  const [update] = usePublishedState("updateAvailable");
  const [progress] = usePublishedState("installProgress");
  if (!update) return null;
  return update.manualInstall ? (
    <ManualUpdate version={update.version} />
  ) : (
    <InstallableUpdate update={update} progress={progress} />
  );
}

function ManualUpdate({ version }: { version: string }) {
  return (
    <section className="update update-manual" aria-label="Update available">
      <p>Version {version} is available. Quit Tether, then download and install the latest release.</p>
      <button onClick={() => void window.tether.invoke("openLatestRelease")}>Open latest release</button>
    </section>
  );
}

function InstallableUpdate({ update, progress }: { update: AvailableUpdate; progress: InstallProgress | null }) {
  const { installing, error, install } = useInstall();
  const [notesOpen, setNotesOpen] = useState(false);
  const [acknowledged, setAcknowledged] = useState<string | null>(null);
  const noticeKey = `${update.version}:${update.notices.map(({ id }) => id).join(",")}`;
  const accepted = update.notices.length === 0 || acknowledged === noticeKey;
  const noticeContent = (
    <NoticeAcknowledgement
      notices={update.notices}
      accepted={accepted}
      onChange={(checked) => setAcknowledged(checked ? noticeKey : null)}
    />
  );
  const installButton = (
    <BusyButton
      label="Install update"
      busyLabel="Installing"
      busy={installing}
      disabled={!accepted}
      onClick={() => void install(update.notices.map(({ id }) => id))}
    />
  );
  const alert = <InstallError error={error} />;
  const footer = (
    <>
      {alert}
      {noticeContent}
      <InstallProgressStrip version={update.version} progress={progress}>
        <div className="release-notes-install">
          <p>Tether relaunches after installing.</p>
          {installButton}
        </div>
      </InstallProgressStrip>
    </>
  );

  return (
    <>
      <UpdateBanner
        version={update.version}
        progress={progress}
        notice={noticeContent}
        installButton={installButton}
        onNotes={() => setNotesOpen(true)}
      />
      {alert}
      {notesOpen && <ReleaseNotesPage target={update.version} onClose={() => setNotesOpen(false)} footer={footer} />}
    </>
  );
}

function UpdateBanner({
  version,
  progress,
  notice,
  installButton,
  onNotes,
}: {
  version: string;
  progress: InstallProgress | null;
  notice: ReactNode;
  installButton: ReactNode;
  onNotes: () => void;
}) {
  return (
    <InstallProgressStrip version={version} progress={progress}>
      <section className="update" aria-label="Update available">
        <div className="update-content">
          <p>Version {version} is available.</p>
          {notice}
          <div className="update-actions">
            <button className="quiet" onClick={onNotes}>
              What's new
            </button>
            {installButton}
          </div>
        </div>
      </section>
    </InstallProgressStrip>
  );
}

function NoticeAcknowledgement({
  notices,
  accepted,
  onChange,
}: {
  notices: ReleaseNotice[];
  accepted: boolean;
  onChange: (checked: boolean) => void;
}) {
  if (notices.length === 0) return null;
  return (
    <div className="update-notices" role="alert">
      <strong>Before you update</strong>
      {notices.map(({ id, message }) => (
        <p key={id}>{message}</p>
      ))}
      <label>
        <input type="checkbox" checked={accepted} onChange={(event) => onChange(event.target.checked)} />
        I have read these notices
      </label>
    </div>
  );
}

function InstallProgressStrip({
  version,
  progress,
  children,
}: {
  version: string;
  progress: InstallProgress | null;
  children: ReactNode;
}) {
  if (!progress) return children;
  const { label, detail, percent } = installStatus(version, progress);
  return (
    <section className="update" aria-label="Installing update">
      <p>
        <strong>{label}</strong> <span className="update-detail">{detail}</span>
      </p>
      {percent !== null && <span className="update-detail">{percent}%</span>}
      <ProgressBar percent={percent} />
    </section>
  );
}

function ProgressBar({ percent }: { percent: number | null }) {
  return percent === null ? (
    <div className="update-progress" role="progressbar" aria-label="Update progress" data-indeterminate>
      <span />
    </div>
  ) : (
    <div className="update-progress" role="progressbar" aria-label="Update progress" aria-valuenow={percent}>
      <span style={{ width: `${percent}%` }} />
    </div>
  );
}

function useInstall() {
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const install = async (acknowledgedNoticeIds: string[]) => {
    setInstalling(true);
    setError(null);
    try {
      await window.tether.invoke("installUpdate", acknowledgedNoticeIds);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not install the update.");
    } finally {
      setInstalling(false);
    }
  };
  return { installing, error, install };
}

function InstallError({ error }: { error: string | null }) {
  return (
    error && (
      <p className="notice" role="alert">
        {error}
      </p>
    )
  );
}
