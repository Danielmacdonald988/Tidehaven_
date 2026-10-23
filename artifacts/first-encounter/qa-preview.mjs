import { createServer } from "node:http";
import { readFile, appendFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
const root = resolve("dist");
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".ttf": "font/ttf",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};
for (const [port, mode] of [
  [4183, "js"],
  [4184, "css"],
  [4185, "font"],
]) {
  let failed = false;
  const server = createServer(async (req, res) => {
    const pathname = new URL(req.url, "http://127.0.0.1").pathname;
    const path = resolve(
      root,
      pathname === "/" ? "index.html" : "." + pathname,
    );
    const fault =
      (mode === "font" && /\.(ttf|woff2?)$/.test(pathname)) ||
      (!failed &&
        mode === "js" &&
        pathname.endsWith(".js") &&
        !pathname.includes("/index-")) ||
      (!failed &&
        mode === "css" &&
        pathname.endsWith(".css") &&
        !pathname.includes("/index-"));
    const headers = { "Cache-Control": "no-store" };
    let status = 200;
    try {
      if (!path.startsWith(root + "/") || pathname.startsWith("/api/")) {
        status = 403;
        throw Error("blocked");
      }
      if (fault) {
        failed = true;
        status = 503;
        throw Error("scoped test asset failure");
      }
      const data = await readFile(path);
      res.writeHead(200, {
        ...headers,
        "Content-Type": types[extname(path)] || "application/octet-stream",
      });
      res.end(data);
    } catch {
      if (status === 200) status = 404;
      res.writeHead(status, headers);
      res.end("Test resource unavailable");
    }
    await appendFile(
      "artifacts/first-encounter/qa-requests.jsonl",
      JSON.stringify({
        time: new Date().toISOString(),
        port,
        mode,
        pathname,
        status,
        fault,
      }) + "\n",
    );
  });
  server.listen(port, "127.0.0.1", () =>
    console.log(`Preview ${mode}: http://127.0.0.1:${port}`),
  );
}
