// Drive the running preview's window over the Chrome DevTools Protocol that launch.sh opened.
//   drive.ts snapshot                       print the page's accessibility tree
//   drive.ts click <role> <name>            click an element by ARIA role and accessible name
//   drive.ts fill <label> <value>           type into a number field and commit it with Enter
//   drive.ts select <label> <option>        pick an option in a select by its label
//   drive.ts screenshot <dir> [name]        save the window as <dir>/<name>.png
//   drive.ts close                          close the window, as its title bar button would
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

// playwright-core is a devDependency of the app, whose package.json is at the repository root.
const { chromium } = createRequire(join(import.meta.dirname, "../../../../package.json"))("playwright-core");

const [command, ...args] = process.argv.slice(2);
const port = readFileSync("/tmp/tether-verify/run.cdp", "utf8").trim();
const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
try {
  // The hidden sound window has no page title; the settings window is titled after the app.
  const pages = browser.contexts().flatMap((context) => context.pages());
  const page = pages.find((candidate) => candidate.url().endsWith("index.html"));
  if (!page) throw new Error("The preview has no open window. Open it from the tray or relaunch.");
  await page.waitForLoadState("load");
  switch (command) {
    case "snapshot":
      console.log(await page.locator("body").ariaSnapshot());
      break;
    case "click":
      await page.getByRole(args[0], { name: args[1], exact: true }).click();
      console.log(`CLICKED ${args[0]} "${args[1]}"`);
      break;
    case "fill": {
      const field = page.getByLabel(args[0], { exact: true });
      await field.fill(args[1]);
      await field.press("Enter");
      console.log(`FILLED "${args[0]}" with ${args[1]}`);
      break;
    }
    case "select":
      await page.getByLabel(args[0], { exact: true }).selectOption({ label: args[1] });
      console.log(`SELECTED "${args[1]}" in "${args[0]}"`);
      break;
    case "screenshot": {
      const path = join(args[0], `${args[1] ?? "screenshot"}.png`);
      await page.screenshot({ path });
      console.log(`SCREENSHOT: ${path}`);
      break;
    }
    case "close":
      await page.close();
      console.log("CLOSED the window");
      break;
    default:
      throw new Error("usage: drive.ts <snapshot | click ROLE NAME | fill LABEL VALUE | select LABEL OPTION | screenshot DIR [NAME] | close>");
  }
} finally {
  // Disconnects without closing the preview.
  await browser.close();
}
