import express from "express";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createIntelligence,
  validateConversationRequest,
} from "../src/intelligence";
dotenv.config({ path: ".env.local" });
dotenv.config();
const bounded = (name: string, fallback: number, maximum: number) => {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0
    ? Math.min(Math.floor(n), maximum)
    : fallback;
};
const decimal = (name: string, fallback: number, max: number) => {
  const value = process.env[name];
  if (value === undefined || value.trim() === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.min(n, max) : fallback;
};
const optionalPrice = (name: string) => {
  const value = process.env[name];
  if (!value?.trim()) return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};
const intelligence = createIntelligence({
  apiKey: process.env.OPENAI_API_KEY,
  model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
  maxRequests: Math.floor(decimal("AI_MAX_REQUESTS", 60, 1000)),
  maxTokens: Math.floor(decimal("AI_MAX_TOKENS", 100000, 1000000)),
  timeoutMs: bounded("AI_TIMEOUT_MS", 12000, 30000),
  maxConcurrency: bounded("AI_MAX_CONCURRENCY", 2, 4),
  maxUsd: decimal("AI_MAX_USD", 1, 100),
  maxOutputTokens: bounded("AI_MAX_OUTPUT_TOKENS", 400, 1600),
  inputUsdPerMillion: optionalPrice("AI_INPUT_USD_PER_MILLION"),
  outputUsdPerMillion: optionalPrice("AI_OUTPUT_USD_PER_MILLION"),
});
export function createApp(service = intelligence) {
  const app = express();
  app.disable("x-powered-by");
  // Block cross-site spending and DNS rebinding; development Vite uses a loopback origin.
  app.use((req, res, next) => {
    const localHost = (host: string) =>
      /^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host);
    if (!localHost(req.headers.host || "")) {
      res.status(403).json({ error: "Loopback host required" });
      return;
    }
    const origin = req.headers.origin;
    if (origin) {
      try {
        const url = new URL(origin);
        if (url.protocol !== "http:" || !localHost(url.host)) throw Error();
      } catch {
        res.status(403).json({ error: "Local application origin required" });
        return;
      }
    }
    if (req.method === "POST" && !req.is("application/json")) {
      res.status(415).json({ error: "JSON required" });
      return;
    }
    next();
  });
  app.use(express.json({ limit: "48kb" }));
  app.get("/api/status", (_req, res) => res.json(service.status()));
  app.post("/api/chat", async (req, res) => {
    if (!validateConversationRequest(req.body)) {
      res.status(400).json({ error: "Invalid conversation request" });
      return;
    }
    res.json(await service.chat(req.body));
  });
  app.use("/api", (_req, res) =>
    res.status(404).json({ error: "Unknown endpoint" }),
  );
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  app.use(express.static(path.join(root, "dist")));
  app.get("/{*splat}", (_req, res) =>
    res.sendFile(path.join(root, "dist/index.html")),
  );
  app.use(
    (
      error: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      void error;
      res.status(400).json({ error: "Request could not be processed" });
    },
  );
  return app;
}
const port = bounded("PORT", 3001, 65535);
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  createApp().listen(port, "127.0.0.1", () =>
    console.log(
      `AFTERLIGHT at http://127.0.0.1:${port} — ${intelligence.status().configured ? "OpenAI configured; not yet live-verified" : "deterministic demo"}`,
    ),
  );
}
