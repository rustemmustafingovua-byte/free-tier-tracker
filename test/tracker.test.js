import { test } from "node:test"
import assert from "node:assert/strict"
import { Tracker, detectLimit } from "../src/index.js"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const tmp = () => join(mkdtempSync(join(tmpdir(), "ftt-")), "state.json")

test("detects the known quota failures", () => {
  assert.equal(detectLimit("Free 10M tokens used.").provider, "apinex")
  assert.equal(detectLimit("429 Rate limit exceeded").kind, "rpm")
  assert.equal(detectLimit("all good"), null)
})

test("tracks spend and exhaustion", () => {
  const t = new Tracker(tmp())
  t.spend("apinex", 1000)
  assert.equal(t.status().providers.find((p) => p.provider === "apinex").tokensUsed, 1000)
  t.note("apinex", "daily_tokens")
  const p = t.status().providers.find((x) => x.provider === "apinex")
  assert.equal(p.exhausted, true)
  t.reset("apinex")
  assert.equal(t.status().providers.find((x) => x.provider === "apinex").exhausted, false)
})

test("warns when the pool is low", () => {
  const t = new Tracker(tmp())
  t.spend("apinex", 9_000_000)
  assert.ok(t.warning().includes("apinex"))
})
