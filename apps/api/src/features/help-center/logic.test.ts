import assert from "node:assert/strict";

import { estimateReadMinutes } from "@workspace/contracts/help-center";

import { slugify, uniqueSlug } from "./slug.js";

let failures = 0;
async function test(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failures++;
    console.error(`  ✗ ${name}`);
    console.error(err instanceof Error ? err.message : err);
  }
}

console.log("help center logic");

await test("slugify: human, lowercase, dashed, diacritics stripped, safe fallback", () => {
  assert.equal(slugify("Getting Started"), "getting-started");
  assert.equal(slugify("  Account & Billing!  "), "account-billing");
  assert.equal(slugify("Café Réservé"), "cafe-reserve");
  assert.equal(slugify("™"), "item"); // empty → fallback
});

await test("uniqueSlug: suffixes -2, -3 on collision", async () => {
  const taken = new Set(["getting-started", "getting-started-2"]);
  assert.equal(
    await uniqueSlug("Getting Started", async (x) => taken.has(x)),
    "getting-started-3"
  );
  assert.equal(
    await uniqueSlug("Brand New", async (x) => taken.has(x)),
    "brand-new"
  );
});

await test("estimateReadMinutes: ~0.6 min/step, min 1", () => {
  assert.equal(estimateReadMinutes(0), 1);
  assert.equal(estimateReadMinutes(1), 1);
  assert.equal(estimateReadMinutes(5), 3);
  assert.equal(estimateReadMinutes(10), 6);
  assert.equal(estimateReadMinutes(20), 12);
});

if (failures > 0) {
  console.error(`\n${failures} help center logic test(s) failed`);
  process.exit(1);
}
console.log("All help center logic tests passed");
