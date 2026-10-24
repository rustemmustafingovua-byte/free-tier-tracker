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
import { readFileSync } from "node:fs"
import { execFileSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const BIN = join(fileURLToPath(new URL("..", import.meta.url)), "bin/free-tier-tracker.js")

test("export writes one JSON object per day and matches documented schema", () => {
  const dir = mkdtempSync(join(tmpdir(), "ftt-export-"))
  const statePath = join(dir, "state.json")
  const exportPath = join(dir, "dashboard.json")

  const t = new Tracker(statePath)
  t.state.history = [{ day: "2026-04-19", providers: { apinex: { tokensUsed: 100_000, failures: 0, exhausted: false, kinds: [] } } }]
  t.spend("apinex", 250_000)
  t.note("groq", "rpm")

  const days = t.export(exportPath)
  assert.equal(Array.isArray(days), true)
  assert.equal(days.length, 2)
  assert.equal(days[0].day, "2026-04-19")
  assert.equal(days[0].totalTokensUsed, 100_000)
  assert.equal(days[1].totalTokensUsed, 250_000)
  assert.equal(days[1].exhaustedCount, 1)

  const disk = JSON.parse(readFileSync(exportPath, "utf8"))
  assert.equal(disk.length, 2)
  for (const d of disk) {
    assert.match(d.day, /^\d{4}-\d{2}-\d{2}$/)
    assert.equal(typeof d.totalTokensUsed, "number")
    assert.equal(typeof d.exhaustedCount, "number")
    assert.equal(Array.isArray(d.providers), true)
  }

  const cliOut = execFileSync("node", [BIN, "--export"], { encoding: "utf8" })
  const parsedCli = JSON.parse(cliOut)
  assert.equal(Array.isArray(parsedCli), true)
  assert.ok(parsedCli.length >= 1)
})
