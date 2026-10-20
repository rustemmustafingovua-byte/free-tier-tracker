#!/usr/bin/env node
/**
 * free-tier-tracker — see what is left of your free tiers.
 *
 *   free-tier-tracker status
 *   free-tier-tracker note "Free 10M tokens used"   # learn from a failure
 *   free-tier-tracker spend apinex 12000             # record normal usage
 *   free-tier-tracker reset apinex
 *   free-tier-tracker watch                         # one-shot check of APInex
 */
import { Tracker, detectLimit } from "../src/index.js"

const argv = process.argv.slice(2)
const cmd = argv[0] || "status"
const tracker = new Tracker()

switch (cmd) {
  case "status": {
    const s = tracker.status()
    console.log(`\nday ${s.day}\n`)
    for (const p of s.providers) {
      const bar = p.ratio === null ? "  —  " : "█".repeat(Math.round(p.ratio * 12)).padEnd(12, "░")
      console.log(
        `  ${p.provider.padEnd(9)} ${bar} ${p.ratio === null ? "" : Math.round(p.ratio * 100) + "%"}  rpm ${String(p.rpm ?? "-").padEnd(3)} ${p.exhausted ? "EXHAUSTED" : p.warn ? "low" : ""}`,
      )
    }
    const w = tracker.warning()
    if (w) console.log(`\n  warnings:\n    ${w.split("\n").join("\n    ")}`)
    console.log("")
    break
  }
  case "note": {
    const text = argv.slice(1).join(" ")
    const d = detectLimit(text)
    if (!d) {
      console.log("no quota signal in that message")
      break
    }
    const p = tracker.note(d.provider, d.kind)
    console.log(`noted: ${d.provider} ${d.kind} (failures ${p.failures})`)
    break
  }
  case "spend": {
    const p = tracker.spend(argv[1] || "unknown", Number(argv[2] || 0))
    console.log(`recorded ${p.tokensUsed} tokens for ${argv[1] || "unknown"}`)
    break
  }
  case "reset": {
    tracker.reset(argv[1])
    console.log(`reset ${argv[1]}`)
    break
  }
  case "watch": {
    const key = process.env.APINEX_API_KEY
    if (!key) {
      console.log("set APINEX_API_KEY to probe the pool")
      break
    }
    const res = await fetch("https://api.apinex.bond/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "free/deepseek-v4-flash-0731", messages: [{ role: "user", content: "ping" }], max_tokens: 1 }),
    })
    const body = await res.json()
    if (res.ok) {
      tracker.reset("apinex")
      console.log("pool is available again")
    } else {
      tracker.note("apinex", "daily_tokens")
      console.log("pool exhausted:", body?.error?.message ?? res.status)
    }
    break
  }
  default:
    console.log("free-tier-tracker <status|note|spend|reset|watch>")
}
