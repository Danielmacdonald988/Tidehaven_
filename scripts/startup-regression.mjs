/** Production-only offline startup smoke. Run after npm run build.
 * Requires an installed Playwright runtime and Chromium; never invokes the API server.
 * Artifacts default outside the repo. Each case has a hard process-group timeout.
 */
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const artifacts =
  process.env.STARTUP_EVIDENCE_DIR ||
  resolve(tmpdir(), "afterlight-startup-evidence");
const origin = "http://127.0.0.1:4174";
const cases = [
  "default",
  "wildlife",
  "rescue",
  "campaign",
  "classic",
  "fail-js",
  "fail-css",
  "fail-webgl",
  "fail-font",
];
await mkdir(artifacts, { recursive: true });
const selected = process.argv[process.argv.indexOf("--case") + 1];
if (process.argv.includes("--case")) {
  const { chromium } = require("playwright");
  const result = {
    case: selected,
    status: "FAIL",
    errors: [],
    externalRequests: [],
    apiRequests: [],
    injected: [],
    environment: {
      platform: process.platform,
      viewport: "1280x720",
      deviceScaleFactor: 1,
      renderer: "not measured",
      note: "Cloud Linux; not Mac evidence. Default region uses saved Performance/75% setting in an isolated save.",
    },
  };
  const stage = async (label) => {
    result.stage = label;
    await writeFile(
      resolve(artifacts, selected + ".json"),
      JSON.stringify(result, null, 2),
    );
  };
  let browser, page;
  try {
    await stage("launch browser");
    browser = await chromium.launch({
      executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
      headless: true,
    });
    result.environment.browser = browser.version();
    await stage("create context");
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      deviceScaleFactor: 1,
    });
    let inject = true;
    await context.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) {
        result.externalRequests.push(url.href);
        return route.abort();
      }
      if (url.pathname.startsWith("/api/")) {
        result.apiRequests.push(url.pathname);
        return route.abort();
      }
      const failure =
        inject &&
        ((selected === "fail-js" &&
          url.pathname.endsWith(".js") &&
          !url.pathname.includes("/index-")) ||
          (selected === "fail-css" &&
            url.pathname.endsWith(".css") &&
            !url.pathname.includes("/index-")) ||
          (selected === "fail-font" &&
            /\.(woff2?|ttf|otf)$/.test(url.pathname)));
      if (failure) {
        result.injected.push(url.pathname);
        return route.abort();
      }
      return route.continue();
    });
    await context.addInitScript(
      ({ webgl }) => {
        localStorage.setItem("afterlight-graphics", "low");
        localStorage.setItem("afterlight-render-scale", "0.75");
        localStorage.setItem("afterlight-depth-shading", "off");
        if (webgl && !sessionStorage.getItem("startup-webgl-failed-once")) {
          sessionStorage.setItem("startup-webgl-failed-once", "1");
          const original = HTMLCanvasElement.prototype.getContext;
          HTMLCanvasElement.prototype.getContext = function (type, ...args) {
            return String(type).startsWith("webgl")
              ? null
              : original.call(this, type, ...args);
          };
        }
      },
      { webgl: selected === "fail-webgl" },
    );
    await stage("create page");
    page = await context.newPage();
    result.fontResponses = [];
    page.on("response", (response) => {
      if (/\.(woff2?|ttf|otf)$/.test(new URL(response.url()).pathname))
        result.fontResponses.push({
          url: response.url(),
          status: response.status(),
        });
    });
    page.setDefaultTimeout(20000);
    page.on("pageerror", (e) => result.errors.push(e.message));
    const search = ["fail-js", "fail-css", "fail-font"].includes(selected)
      ? "?classic"
      : ["default", "fail-webgl", "fail-font"].includes(selected)
        ? ""
        : "?" + selected;
    const start = Date.now();
    await stage("navigate");
    await page.goto(origin + "/" + search, {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });
    await stage("verify UI and interaction");
    if (["fail-js", "fail-css", "fail-webgl"].includes(selected)) {
      const alert = page.getByRole("alert");
      await alert.waitFor({ state: "visible" });
      result.recoveryText = await alert.innerText();
      result.recoveryPanel = "PASS";
      result.retry = "NOT RUN";
      await writeFile(
        resolve(artifacts, selected + ".json"),
        JSON.stringify(result, null, 2),
      );
      await page.screenshot({
        path: resolve(artifacts, selected + "-recovery.png"),
        timeout: 10000,
      });
      if (selected !== "fail-webgl" && result.injected.length === 0)
        throw Error("Fault injection did not intercept an asset");
      await page.evaluate(() =>
        localStorage.setItem(
          "startup-review-save-sentinel",
          "preserve-this-save",
        ),
      );
      inject = false;
      result.retry = "RUNNING";
      await stage("retry after recovery");
      await page.getByRole("button", { name: /Try again|Retry/i }).click();
      if (selected === "fail-webgl") {
        await page
          .getByRole("button", { name: "Coastal map", exact: true })
          .waitFor({ state: "visible", timeout: 45000 });
        await page
          .getByRole("button", { name: "Coastal map", exact: true })
          .click();
        await page
          .getByRole("dialog", { name: "The connected coast" })
          .waitFor();
        result.interaction =
          "Recovery displayed; Try again reloaded successfully; Coastal map opened";
      } else {
        await page
          .getByRole("button", { name: /People first/ })
          .waitFor({ timeout: 45000 });
        result.interaction =
          "Recovery displayed; Try again reloaded classic; entry control clicked";
        await page.getByRole("button", { name: /People first/ }).click();
      }
      result.retry = "PASS";
      if (
        (await page.evaluate(() =>
          localStorage.getItem("startup-review-save-sentinel"),
        )) !== "preserve-this-save"
      )
        throw Error("Retry lost storage sentinel");
    } else if (selected === "default" || selected === "wildlife") {
      await page
        .getByRole("button", { name: "Exploration options", exact: true })
        .waitFor({ timeout: 45000 });
      await page
        .getByRole("button", { name: "Exploration options", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Close exploration options", exact: true })
        .waitFor();
      await page
        .getByRole("button", { name: "Close exploration options", exact: true })
        .click();
      result.interaction = "Opened and closed exploration options";
    } else if (selected === "rescue") {
      await page
        .getByRole("button", { name: "Rescue settings", exact: true })
        .waitFor({ timeout: 45000 });
      await page
        .getByRole("button", { name: "Rescue settings", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Close options", exact: true })
        .waitFor();
      result.interaction = "Opened rescue options";
    } else if (selected === "campaign") {
      const enter = page.getByRole("button", { name: /Step into Bellwether/ });
      await enter.waitFor({ timeout: 45000 });
      await enter.click();
      await page
        .getByRole("dialog", { name: "Welcome to the neighborhood" })
        .waitFor({ state: "hidden" });
      result.interaction =
        "Dismissed enabled campaign welcome and entered neighborhood";
    } else {
      await page
        .getByRole("button", { name: /People first/ })
        .waitFor({ timeout: 45000 });
      const button = page.getByRole("button", { name: /People first/ });
      result.interaction =
        "Clicked classic entry control: " + (await button.innerText());
      await button.click();
      await page
        .getByRole("dialog", { name: "Welcome to Afterlight" })
        .waitFor({ state: "hidden" });
    }
    if (
      !["fail-js", "fail-css", "fail-webgl", "fail-font"].includes(selected)
    ) {
      await stage("verify font faces");
      result.fonts = await page.evaluate(async () => {
        const queries = [
          '400 16px "DM Sans"',
          '500 16px "DM Sans"',
          '600 16px "DM Sans"',
          '700 16px "DM Sans"',
          '400 16px "Libre Caslon Display"',
        ];
        return Promise.all(
          queries.map(async (query) => ({
            query,
            faces: (await document.fonts.load(query)).map((face) => ({
              family: face.family,
              status: face.status,
            })),
          })),
        );
      });
      if (
        result.fonts.some(
          (item) =>
            !item.faces.length ||
            item.faces.some((face) => face.status !== "loaded"),
        )
      )
        throw Error("Bundled font did not load");
    }
    if (selected === "default") {
      await stage("verify saved keyboard movement");
      await page.waitForTimeout(2200);
      result.playerBefore = await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("afterlight-region-v1")).wildlife
            .player,
      );
      await page.locator("canvas").first().focus();
      await page.keyboard.down("KeyD");
      await page.waitForTimeout(1200);
      await page.keyboard.up("KeyD");
      await page.waitForTimeout(2200);
      result.playerAfter = await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("afterlight-region-v1")).wildlife
            .player,
      );
      if (
        Math.hypot(
          result.playerAfter.x - result.playerBefore.x,
          result.playerAfter.z - result.playerBefore.z,
        ) < 0.1
      )
        throw Error("Keyboard movement did not change saved player position");
      result.interaction += "; keyboard movement changed saved player position";
    }
    result.navigationAndInteractionMs = Date.now() - start;
    await stage("capture evidence");
    result.bodyText = (await page.locator("body").innerText()).slice(0, 2500);
    result.canvasCount = await page.locator("canvas").count();
    result.environment.renderer = await page.evaluate(() => {
      const canvas = document.querySelector("canvas");
      const gl = canvas?.getContext("webgl2");
      if (!gl) return "No WebGL2 canvas";
      const ext = gl.getExtension("WEBGL_debug_renderer_info");
      return ext
        ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
        : gl.getParameter(gl.RENDERER);
    });
    await page.screenshot({
      path: resolve(artifacts, selected + ".png"),
      timeout: 10000,
    });
    if (selected === "fail-font" && !result.injected.length)
      throw Error("Font failure case did not intercept a font");
    if (result.externalRequests.length)
      throw Error("Startup attempted external resources");
    if (
      !["fail-js", "fail-css", "fail-webgl"].includes(selected) &&
      result.errors.length
    )
      throw Error("Unexpected page error");
    if (
      !["classic", "fail-js", "fail-css", "fail-font"].includes(selected) &&
      !result.canvasCount
    )
      throw Error("No game canvas after startup");
    result.status = "PASS";
  } catch (error) {
    result.failure = String(error);
    if (result.retry === "RUNNING") result.retry = "FAIL";
    try {
      await page?.screenshot({
        path: resolve(artifacts, selected + "-failure.png"),
        timeout: 5000,
      });
      result.failureScreenshot = page ? "captured" : "no page";
    } catch (captureError) {
      result.failureScreenshot = "failed: " + String(captureError);
    }
  } finally {
    await writeFile(
      resolve(artifacts, selected + ".json"),
      JSON.stringify(result, null, 2),
    );
    await browser?.close();
  }
  console.log(JSON.stringify(result));
  process.exitCode = result.status === "PASS" ? 0 : 1;
} else {
  const types = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".css": "text/css",
    ".woff2": "font/woff2",
    ".woff": "font/woff",
    ".ttf": "font/ttf",
    ".otf": "font/otf",
    ".png": "image/png",
  };
  const server = createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, origin).pathname);
      const path = resolve(
        root,
        "dist",
        pathname === "/" ? "index.html" : "." + pathname,
      );
      if (!path.startsWith(resolve(root, "dist") + "/")) {
        res.writeHead(403);
        return res.end();
      }
      const content = await readFile(path);
      res.writeHead(200, {
        "Content-Type": types[extname(path)] || "application/octet-stream",
        "Cache-Control": "no-store",
      });
      res.end(content);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  });
  await new Promise((done, reject) => {
    server.once("error", reject);
    server.listen(4174, "127.0.0.1", done);
  });
  const results = [];
  const filter = process.env.STARTUP_CASES?.split(",") || cases;
  try {
    for (const name of filter) {
      const child = spawn(
        process.execPath,
        [fileURLToPath(import.meta.url), "--case", name],
        { cwd: root, detached: true, stdio: ["ignore", "pipe", "pipe"] },
      );
      let output = "",
        timedOut = false;
      child.stdout.on("data", (d) => (output += d));
      child.stderr.on("data", (d) => (output += d));
      const timeout = setTimeout(
        () => {
          timedOut = true;
          try {
            process.kill(-child.pid, "SIGKILL");
          } catch {}
        },
        Number(process.env.STARTUP_CASE_TIMEOUT_MS || 75000),
      );
      const code = await new Promise((done) => child.once("exit", done));
      clearTimeout(timeout);
      // Ensure a failed browser cannot leave GPU descendants alive between cases.
      try {
        process.kill(-child.pid, "SIGKILL");
      } catch {}
      await writeFile(resolve(artifacts, name + ".log"), output);
      let result;
      try {
        result = JSON.parse(
          await readFile(resolve(artifacts, name + ".json"), "utf8"),
        );
      } catch {
        result = { case: name, status: "FAIL" };
      }
      if (timedOut)
        result = {
          ...result,
          status: "FAIL",
          failure: "Hard case timeout; browser process group terminated",
        };
      else if (code !== 0) result.status = "FAIL";
      results.push(result);
      console.log(
        name +
          ": " +
          result.status +
          (result.failure ? " — " + result.failure.split("\n")[0] : ""),
      );
    }
  } finally {
    server.close();
  }
  await writeFile(
    resolve(artifacts, "summary.json"),
    JSON.stringify(results, null, 2),
  );
  process.exitCode = results.every((r) => r.status === "PASS") ? 0 : 1;
}
