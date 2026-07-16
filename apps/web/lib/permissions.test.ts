import assert from "node:assert/strict"

import { asRole, can } from "./permissions"

let failures = 0
function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`  ✓ ${name}`)
  } catch (err) {
    failures++
    console.error(`  ✗ ${name}`)
    console.error(err instanceof Error ? err.message : err)
  }
}

console.log("workspace permissions")

test("owner can do everything", () => {
  for (const a of ["workspace:edit", "workspace:delete", "member:invite", "member:role", "member:remove"] as const) {
    assert.equal(can("owner", a), true, a)
  }
})

test("admin can manage workspace + members but not delete it", () => {
  assert.equal(can("admin", "workspace:edit"), true)
  assert.equal(can("admin", "member:invite"), true)
  assert.equal(can("admin", "member:role"), true)
  assert.equal(can("admin", "member:remove"), true)
  assert.equal(can("admin", "workspace:delete"), false)
})

test("member can do none of the workspace/member actions", () => {
  for (const a of ["workspace:edit", "workspace:delete", "member:invite", "member:role", "member:remove"] as const) {
    assert.equal(can("member", a), false, a)
  }
})

test("undefined/null role is denied everything", () => {
  assert.equal(can(undefined, "workspace:edit"), false)
  assert.equal(can(null, "member:invite"), false)
})

test("asRole normalizes unknown roles to member", () => {
  assert.equal(asRole("owner"), "owner")
  assert.equal(asRole("admin"), "admin")
  assert.equal(asRole("member"), "member")
  assert.equal(asRole("superadmin"), "member")
  assert.equal(asRole(null), "member")
  assert.equal(asRole(undefined), "member")
})

if (failures > 0) {
  console.error(`\n${failures} permission test(s) failed`)
  process.exit(1)
}
console.log("All permission tests passed")
