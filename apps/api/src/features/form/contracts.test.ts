import assert from "node:assert/strict";

import {
  emptyFormDocument,
  formDocumentSchema,
  parseFormDocument,
  resolveFormDesign,
  validateSubmission,
  type FormField,
} from "@workspace/contracts/form";

/**
 * Form contracts (Phase 1) — pure schema + validation checks. No DB.
 * Run: `npm test -w api`.
 */

let failures = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failures++;
    console.error(`  ✗ ${name}`);
    console.error(err instanceof Error ? err.message : err);
  }
}

function field(partial: Partial<FormField> & { key: string; type: FormField["type"] }): FormField {
  return {
    key: partial.key,
    type: partial.type,
    title: partial.title ?? "Q",
    description: partial.description ?? "",
    required: partial.required ?? false,
    config: {
      placeholder: "",
      maxLength: null,
      min: null,
      max: null,
      options: [],
      allowOther: false,
      buttonText: "",
      ...partial.config,
    },
  };
}

console.log("form contracts");

test("emptyFormDocument parses + round-trips through the schema", () => {
  const doc = emptyFormDocument("Untitled", null);
  assert.equal(doc.v, 1);
  assert.deepEqual(doc.fields, []);
  const parsed = formDocumentSchema.safeParse(doc);
  assert.equal(parsed.success, true);
  assert.equal(doc.design.font, "Geist");
  assert.equal(doc.settings.acceptingSubmissions, true);
  assert.equal(doc.thankYou.title, "Thank you!");
});

test("parseFormDocument fills defaults for a minimal doc", () => {
  const res = parseFormDocument({
    v: 1,
    title: "T",
    description: null,
    fields: [{ key: "a", type: "short_text" }],
  });
  assert.equal(res.success, true);
  if (res.success) {
    assert.equal(res.data.fields[0]!.required, false);
    assert.equal(res.data.fields[0]!.config.options.length, 0);
    assert.equal(res.data.design.button, "#5e6ad2");
  }
});

test("parseFormDocument rejects an unknown version", () => {
  const res = parseFormDocument({ v: 2, title: "x", description: null, fields: [] });
  assert.equal(res.success, false);
});

test("resolveFormDesign merges partial + falls back on null", () => {
  const merged = resolveFormDesign({ button: "#000000" });
  assert.equal(merged.button, "#000000");
  assert.equal(merged.background, "#ffffff"); // default preserved
  const fallback = resolveFormDesign(null);
  assert.equal(fallback.font, "Geist");
});

test("validateSubmission: required + statement skipped", () => {
  const fields = [
    field({ key: "s", type: "statement" }),
    field({ key: "name", type: "short_text", required: true }),
  ];
  assert.equal(validateSubmission(fields, {}).length, 1); // only name required
  assert.equal(validateSubmission(fields, { name: "Sam" }).length, 0);
  assert.equal(validateSubmission(fields, { name: "   " }).length, 1); // blank string
});

test("validateSubmission: email / number / rating", () => {
  const fields = [
    field({ key: "e", type: "email", required: true }),
    field({ key: "n", type: "number", config: { min: 1, max: 10 } as never }),
    field({ key: "r", type: "rating", config: { max: 5 } as never }),
  ];
  assert.equal(validateSubmission(fields, { e: "bad" }).length >= 1, true);
  assert.equal(validateSubmission(fields, { e: "a@b.com" }).length, 0);
  assert.equal(validateSubmission(fields, { e: "a@b.com", n: 20 }).length, 1);
  assert.equal(validateSubmission(fields, { e: "a@b.com", n: 5 }).length, 0);
  assert.equal(validateSubmission(fields, { e: "a@b.com", r: 6 }).length, 1);
  assert.equal(validateSubmission(fields, { e: "a@b.com", r: 3 }).length, 0);
});

test("validateSubmission: select membership + multi_select bounds", () => {
  const opts = { options: [{ key: "a", label: "A" }, { key: "b", label: "B" }] };
  const fields = [
    field({ key: "c", type: "single_select", config: opts as never }),
    field({ key: "m", type: "multi_select", config: { ...opts, min: 1, max: 2 } as never }),
  ];
  assert.equal(validateSubmission(fields, { c: "z" }).length, 1); // not an option
  assert.equal(validateSubmission(fields, { c: "a" }).length, 0);
  assert.equal(validateSubmission(fields, { m: ["a", "b"] }).length, 0);
  assert.equal(validateSubmission(fields, { m: ["a", "z"] }).length, 1); // invalid member
});

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log("\nAll form contract tests passed");
