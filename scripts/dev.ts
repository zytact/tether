import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { createRequire } from "node:module";
import { setTimeout as sleep } from "node:timers/promises";

/** Runs the page on the Vite dev server, rebuilds the main process as it changes, and opens Electron
 * on both. Main process changes take effect on the next launch. */
const DEV_SERVER = "http://localhost:1421";
/** Outside Electron the package resolves to the path of its binary. */
const electron: string = createRequire(import.meta.url)("electron");
const children: ChildProcess[] = [];
const run = (command: string, args: string[], env = process.env) => {
  const child = spawn(command, args, { stdio: "inherit", env });
  children.push(child);
  return child;
};
const stop = () => {
  for (const child of children) child.kill();
};
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, stop);

await new Promise((resolve) => run("vp", ["pack"]).on("exit", resolve));
run("vp", ["pack", "--watch"]);
run("vp", ["dev"]);
while (
  !(await fetch(DEV_SERVER).then(
    (response) => response.ok,
    () => false,
  ))
)
  await sleep(200);

// A shell inside another Electron app can carry this variable, which would start a bare Node instead.
const { ELECTRON_RUN_AS_NODE: _, ...env } = process.env;
run(electron, ["."], { ...env, VITE_DEV_SERVER_URL: DEV_SERVER }).on("exit", stop);
