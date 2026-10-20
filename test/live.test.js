// Integration test against the real service. Skipped unless LIVE=1.
//   LIVE=1 npm test
import { test } from "node:test"
import assert from "node:assert/strict"

const LIVE = process.env.LIVE === "1"
const skip = LIVE ? false : "set LIVE=1 to run the integration test"

import { Tracker, detectLimit } from "../src/index.js"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

test("the real APInex pool reports its state", { skip }, async () => {
  const key = process.env.APINEX_API_KEY
  if (!key) return
  const res = await fetch("https://api.apinex.bond/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "free/deepseek-v4-flash-0731",
      messages: [{ role: "user", content: "ping" }],
      max_tokens: 1,
    }),
  })
  const body = await res.json()
  if (res.ok) {
    const tracker = new Tracker(join(mkdtempSync(join(tmpdir(), "ftt-")), "state.json"))
    tracker.reset("apinex")
    assert.equal(tracker.status().providers.find((p) => p.provider === "apinex").exhausted, false)
  } else {
    assert.equal(detectLimit(body?.error?.message).provider, "apinex")
  }
})
