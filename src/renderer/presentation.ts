import type { InstallProgress } from "../shared/ipc";

export function installStatus(version: string, progress: InstallProgress) {
  if (progress.stage === "install") return { label: "Installing", detail: `v${version}`, percent: null };
  const { received, total } = progress;
  return {
    label: "Downloading",
    detail: `v${version} · ${total ? `${megabytes(received)} of ${megabytes(total)}` : megabytes(received)} MB`,
    percent: total ? Math.min(100, Math.floor((received / total) * 100)) : null,
  };
}

const megabytes = (bytes: number) => (bytes / 1e6).toFixed(1);
