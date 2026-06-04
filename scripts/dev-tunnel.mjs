#!/usr/bin/env node
// Starts ngrok -> patches NEXT_PUBLIC_SITE_URL in .env.local -> launches `next dev`.
// On exit, restores the original .env.local. Required for the Kustom push webhook
// and merchant_urls validation (Playground rejects http://localhost URLs).
//
// Usage: npm run dev:tunnel
// Env:   PORT=3005 (default)  NGROK_DOMAIN=<reserved-domain>  (optional, paid plan)
//
// Note: the Medusa backend (products/cart/orders) must be running separately
// (cd medusa && PORT=9010 npm run dev) — this script only tunnels the storefront
// so Kustom's KSA / push callbacks can reach your local /api/kustom/* routes.

import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, copyFileSync, unlinkSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const PORT = process.env.PORT ?? "3005";
const ENV_FILE = ".env.local";
const BACKUP_FILE = ".env.local.tunnel-backup";
const NGROK_API = "http://127.0.0.1:4040/api/tunnels";
const NGROK_LOG = ".ngrok.log";

let ngrokProc;
let devProc;
let restored = false;

function log(msg) {
  process.stdout.write(`[dev:tunnel] ${msg}\n`);
}

function patchEnv(publicUrl) {
  if (!existsSync(ENV_FILE)) {
    throw new Error(`${ENV_FILE} not found — copy env.example to .env.local first`);
  }
  copyFileSync(ENV_FILE, BACKUP_FILE);
  const src = readFileSync(ENV_FILE, "utf8");
  const line = `NEXT_PUBLIC_SITE_URL=${publicUrl}`;
  const next = /^NEXT_PUBLIC_SITE_URL=.*$/m.test(src)
    ? src.replace(/^NEXT_PUBLIC_SITE_URL=.*$/m, line)
    : `${src.replace(/\n?$/, "\n")}${line}\n`;
  writeFileSync(ENV_FILE, next);
  log(`patched NEXT_PUBLIC_SITE_URL=${publicUrl} (backup: ${BACKUP_FILE})`);
}

function restoreEnv() {
  if (restored) return;
  restored = true;
  if (existsSync(BACKUP_FILE)) {
    copyFileSync(BACKUP_FILE, ENV_FILE);
    unlinkSync(BACKUP_FILE);
    log(`restored ${ENV_FILE}`);
  }
}

async function waitForNgrokUrl({ attempts = 40, delayMs = 250 } = {}) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(NGROK_API);
      if (res.ok) {
        const data = await res.json();
        const httpsTunnel = data.tunnels?.find((t) => t.public_url?.startsWith("https://"));
        if (httpsTunnel) return httpsTunnel.public_url;
      }
    } catch {
      // ngrok not ready yet
    }
    await sleep(delayMs);
  }
  throw new Error(`ngrok did not report an HTTPS tunnel within ${attempts * delayMs}ms`);
}

function shutdown(code = 0) {
  restoreEnv();
  if (devProc && !devProc.killed) devProc.kill("SIGTERM");
  if (ngrokProc && !ngrokProc.killed) ngrokProc.kill("SIGTERM");
  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
process.on("exit", restoreEnv);
process.on("uncaughtException", (err) => {
  console.error(err);
  shutdown(1);
});

async function main() {
  const ngrokArgs = ["http", PORT, `--log=${NGROK_LOG}`, "--log-format=logfmt"];
  if (process.env.NGROK_DOMAIN) {
    ngrokArgs.push(`--domain=${process.env.NGROK_DOMAIN}`);
  }

  log(`starting ngrok http ${PORT}…`);
  ngrokProc = spawn("ngrok", ngrokArgs, { stdio: "ignore" });
  ngrokProc.on("exit", (code) => {
    log(`ngrok exited (${code})`);
    shutdown(code ?? 0);
  });

  const publicUrl = await waitForNgrokUrl();
  log(`ngrok URL: ${publicUrl}`);
  log(`ngrok web inspector: http://127.0.0.1:4040`);
  patchEnv(publicUrl);

  log(`starting next dev on port ${PORT}…`);
  devProc = spawn("npx", ["next", "dev", "-p", PORT], {
    stdio: "inherit",
    env: { ...process.env, NEXT_PUBLIC_SITE_URL: publicUrl },
  });
  devProc.on("exit", (code) => {
    log(`next dev exited (${code})`);
    shutdown(code ?? 0);
  });
}

main().catch((err) => {
  console.error("[dev:tunnel] fatal:", err.message);
  shutdown(1);
});
