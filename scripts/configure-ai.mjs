import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Run locally in a terminal. Never echo a credential or put it in shell history.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.join(root, ".env.local");
try {
  if (
    execFileSync("git", ["ls-files", "--", ".env.local"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim()
  ) {
    console.error("Refusing to write a credential into a tracked file.");
    process.exit(1);
  }
} catch {
  console.error(
    "Cannot verify the local credential file is untracked. No file changed.",
  );
  process.exit(1);
}

if (!process.stdin.isTTY || !process.stdout.isTTY) {
  console.error(
    "Run npm run setup:ai in your own interactive terminal. Do not paste a key into chat.",
  );
  process.exit(1);
}
if (fs.existsSync(target) && !fs.lstatSync(target).isFile()) {
  console.error("Refusing a symlink or non-file credential destination.");
  process.exit(1);
}
console.log("AFTERLIGHT · local OpenAI setup");
console.log(
  "This stores your key only in the git-ignored .env.local file (owner-only permissions).",
);
console.log(
  "Create a project key in your OpenAI Platform account first. No request is sent by setup.",
);
process.stdout.write(
  "Paste your project API key here (hidden), then press Return. Ctrl+C cancels: ",
);
readline.emitKeypressEvents(process.stdin);
process.stdin.setRawMode(true);
process.stdin.resume();
let value = "";
function finish() {
  process.stdin.setRawMode(false);
  process.stdin.pause();
  process.stdout.write("\n");
}
process.stdin.on("keypress", (text, key = {}) => {
  if (key.ctrl && key.name === "c") {
    finish();
    process.exit(130);
  }
  if (key.name === "return" || key.name === "enter") {
    finish();
    const secret = value.trim();
    value = "";
    if (!/^sk-[A-Za-z0-9_-]{20,}$/.test(secret)) {
      console.error("Key format was not recognized. No file was changed.");
      process.exit(1);
    }
    let content = fs.existsSync(target) ? fs.readFileSync(target, "utf8") : "";
    const line = `OPENAI_API_KEY=${secret}`;
    content = /^\s*OPENAI_API_KEY\s*=.*$/m.test(content)
      ? content.replace(/^\s*OPENAI_API_KEY\s*=.*$/m, line)
      : `${content}${content && !content.endsWith("\n") ? "\n" : ""}${line}\n`;
    const fd = fs.openSync(
      target,
      fs.constants.O_WRONLY |
        fs.constants.O_CREAT |
        fs.constants.O_TRUNC |
        fs.constants.O_NOFOLLOW,
      0o600,
    );
    fs.fchmodSync(fd, 0o600);
    fs.writeFileSync(fd, content);
    fs.closeSync(fd);
    console.log(
      "Saved securely. Restart AFTERLIGHT to enable model-backed characters.",
    );
    process.exit(0);
  }
  if (key.name === "backspace") value = value.slice(0, -1);
  else if (text && !key.ctrl && !key.meta) value += text.replace(/[\r\n]/g, "");
  if (value.length > 1024) {
    finish();
    console.error("Input too long; no file changed.");
    process.exit(1);
  }
});
