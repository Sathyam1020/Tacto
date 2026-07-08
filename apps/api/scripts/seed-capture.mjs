/**
 * Seed a fixture capture through the REAL API (auth → workspace → capture),
 * exercising the entire chain end-to-end. Dev tooling only.
 *
 * Usage: node scripts/seed-capture.mjs [fixture-path]
 * Env:   SEED_EMAIL / SEED_PASSWORD (defaults below), API base via SEED_API.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const API = process.env.SEED_API ?? "http://localhost:3000";
const EMAIL = process.env.SEED_EMAIL ?? "seed@tacto.dev";
const PASSWORD = process.env.SEED_PASSWORD ?? "seed-password-123";
const fixturePath = resolve(
  process.argv[2] ?? "../worker/fixtures/stripe-onboarding.json"
);

const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));

/** Cookie jar across requests (better-auth session). */
let cookies = "";
function storeCookies(res) {
  const set = res.headers.getSetCookie?.() ?? [];
  if (set.length) {
    cookies = set.map((c) => c.split(";")[0]).join("; ");
  }
}

async function call(path, { method = "GET", body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Origin: API,
      ...(cookies ? { Cookie: cookies } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  storeCookies(res);
  return { status: res.status, body: await res.json().catch(() => null) };
}

// 1. Sign in; create the seed user on first run.
let auth = await call("/api/auth/sign-in/email", {
  method: "POST",
  body: { email: EMAIL, password: PASSWORD },
});
if (auth.status !== 200) {
  console.log("seed user does not exist yet — signing up…");
  auth = await call("/api/auth/sign-up/email", {
    method: "POST",
    body: { name: "Seed User", email: EMAIL, password: PASSWORD },
  });
  if (auth.status !== 200) {
    console.error("sign-up failed:", auth.body);
    process.exit(1);
  }
}
console.log(`signed in as ${EMAIL}`);

// 2. Confirm the active workspace (also triggers self-heal if needed).
const ws = await call("/api/workspace/current");
if (ws.status !== 200) {
  console.error("no active workspace:", ws.body);
  process.exit(1);
}
console.log(`workspace: ${ws.body.workspace.name}`);

// 3. Create the capture — this enqueues the processing job.
const capture = await call("/api/captures", { method: "POST", body: fixture });
if (capture.status !== 201) {
  console.error("capture creation failed:", capture.body);
  process.exit(1);
}
const captureId = capture.body.capture.id;
console.log(`capture created: ${captureId} (${capture.body.capture.status})`);

// 4. Poll until the worker finishes.
for (let i = 0; i < 30; i++) {
  await new Promise((r) => setTimeout(r, 2000));
  const status = await call(`/api/captures/${captureId}`);
  const { status: captureStatus, errorMessage, guides } = status.body.capture;
  process.stdout.write(`  status: ${captureStatus}\n`);
  if (captureStatus === "READY") {
    console.log(`✓ guide created: ${guides[0]?.id}`);
    console.log(`  open http://localhost:3000/guides/${guides[0]?.id}`);
    process.exit(0);
  }
  if (captureStatus === "FAILED") {
    console.error(`✗ processing failed: ${errorMessage}`);
    process.exit(1);
  }
}
console.error("timed out waiting for processing");
process.exit(1);
