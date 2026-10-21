import { test } from "node:test"
import assert from "node:assert/strict"
import { PROBES, probeProvider, probeKey, Tracker } from "../src/index.js"

test("парсер APInex достаёт баланс и rpm", () => {
  const r = PROBES.apinex.parse({
    balance_usd: 1.25,
    rpm: 5,
    rpm_plan: "free",
    api_key: { spent_usd: 0.75 },
  })
  assert.equal(r.balanceUsd, 1.25)
  assert.equal(r.spentUsd, 0.75)
  assert.equal(r.rpm, 5)
  assert.equal(r.plan, "free")
  assert.equal(r.exhausted, false)
})

test("парсер BeatAPI достаёт кредиты", () => {
  const r = PROBES.beatapi.parse({ data: { credit_balance: 3, credits_spent: 1 } })
  assert.equal(r.balanceUsd, 3)
  assert.equal(r.spentUsd, 1)
  assert.equal(r.exhausted, false)
})

test("нулевой баланс = исчерпано", () => {
  assert.equal(PROBES.apinex.parse({ balance_usd: 0 }).exhausted, true)
  assert.equal(PROBES.beatapi.parse({ data: { credit_balance: 0 } }).exhausted, true)
})

test("проба неизвестного провайдера не падает, а честно сообщает", async () => {
  const r = await probeProvider("nope")
  assert.equal(r.ok, false)
  assert.match(r.reason, /пробы/)
  assert.equal(probeKey("nope"), null)
})

test("проба читает ответ провайдера (без сети)", async () => {
  const fakeFetch = async () => ({
    ok: true,
    status: 200,
    async json() {
      return { balance_usd: 2, rpm: 5, rpm_plan: "free", api_key: { spent_usd: 0 } }
    },
  })
  const saved = process.env.APINEX_API_KEY
  process.env.APINEX_API_KEY = "test-key"
  const r = await probeProvider("apinex", { fetchImpl: fakeFetch })
  assert.equal(r.ok, true)
  assert.equal(r.balanceUsd, 2)
  assert.equal(r.rpm, 5)
  if (saved) process.env.APINEX_API_KEY = saved
  else delete process.env.APINEX_API_KEY
})

test("refresh кладёт живые данные в статус", async () => {
  const fakeFetch = async (url) => {
    if (String(url).includes("apinex")) {
      return { ok: true, status: 200, async json() { return { balance_usd: 4, rpm: 5, rpm_plan: "free", api_key: { spent_usd: 0 } } } }
    }
    return { ok: true, status: 200, async json() { return { data: { credit_balance: 7 } } } }
  }
  const savedA = process.env.APINEX_API_KEY
  const savedB = process.env.BEATAPI_API_KEY
  process.env.APINEX_API_KEY = "k"
  process.env.BEATAPI_API_KEY = "k"

  const tracker = new Tracker("/tmp/free-tier-tracker-test/state.json")
  const results = await tracker.refresh({ fetchImpl: fakeFetch })
  assert.equal(results.apinex.ok, true)
  const status = tracker.status()
  const apinex = status.providers.find((p) => p.provider === "apinex")
  assert.equal(apinex.live.balanceUsd, 4)
  assert.equal(apinex.live.rpm, 5)

  if (savedA) process.env.APINEX_API_KEY = savedA
  else delete process.env.APINEX_API_KEY
  if (savedB) process.env.BEATAPI_API_KEY = savedB
  else delete process.env.BEATAPI_API_KEY
})
