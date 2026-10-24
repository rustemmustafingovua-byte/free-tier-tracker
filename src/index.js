/**
 * free-tier-tracker — know your free quota before it runs out.
 *
 * Free tiers do not announce that they are nearly gone: the model just
 * answers `402 Free 10M tokens used` in the middle of a run. This keeps a
 * local ledger of what each provider has left, learns from the failures you
 * already hit, and warns you before the next call dies.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

export const DEFAULT_STATE = join(homedir(), ".config", "free-tier-tracker", "state.json")

/**
 * Живые пробы провайдеров: сколько на самом деле осталось квоты.
 * Ключ берётся из переменной окружения, иначе из стандартного пути секретов.
 */
export const PROBES = {
  apinex: {
    label: "APInex",
    url: "https://api.apinex.bond/v1/balance",
    env: "APINEX_API_KEY",
    secret: "apinex.key",
    parse(j) {
      return {
        balanceUsd: Number(j?.balance_usd ?? 0),
        spentUsd: Number(j?.api_key?.spent_usd ?? 0),
        rpm: Number(j?.rpm ?? 0),
        plan: j?.rpm_plan ?? null,
        exhausted: Number(j?.balance_usd ?? 0) <= 0,
      }
    },
  },
  beatapi: {
    label: "BeatAPI",
    url: "https://api.beatapi.io/v1/usage",
    env: "BEATAPI_API_KEY",
    secret: "beatapi.key",
    parse(j) {
      return {
        balanceUsd: Number(j?.data?.credit_balance ?? 0),
        spentUsd: Number(j?.data?.credits_spent ?? j?.data?.credits_used ?? 0),
        rpm: 1,
        plan: "free",
        exhausted: Number(j?.data?.credit_balance ?? 0) <= 0,
      }
    },
  },
}

const SECRETS_DIR = join(homedir(), ".config", "opencode", "secrets")

/** Ключ провайдера: переменная окружения или файл секрета. */
export function probeKey(provider) {
  const p = PROBES[provider]
  if (!p) return null
  if (process.env[p.env]) return process.env[p.env].trim()
  try {
    const f = join(SECRETS_DIR, p.secret)
    if (existsSync(f)) return readFileSync(f, "utf8").trim()
  } catch {}
  return null
}

/** Спросить провайдера про остаток квоты. */
export async function probeProvider(provider, { fetchImpl = fetch, timeoutMs = 12000 } = {}) {
  const p = PROBES[provider]
  if (!p) return { provider, ok: false, reason: "нет пробы для провайдера" }
  const key = probeKey(provider)
  if (!key) return { provider, ok: false, reason: "нет ключа" }
  try {
    const res = await fetchImpl(p.url, {
      headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!res.ok) return { provider, ok: false, reason: `HTTP ${res.status}` }
    const json = await res.json()
    return { provider, ok: true, at: Date.now(), ...p.parse(json) }
  } catch (e) {
    return { provider, ok: false, reason: e?.message ?? String(e) }
  }
}

export const LIMITS = {
  apinex: { dailyTokens: 10_000_000, rpm: 5 },
  beatapi: { dailyTokens: null, rpm: 1, rpmAfterTopup: 10 },
  copilot: { dailyTokens: null, rpm: 30, monthlyRequests: 50 },
  zen: { dailyTokens: null, rpm: null },
}

export function today(now = new Date()) {
  return now.toISOString().slice(0, 10)
}

/** Recognise the failures that mean "quota gone". */
export function detectLimit(text) {
  const s = String(text || "")
  if (/free\s+\d+m?\s*tokens\s+used/i.test(s)) return { provider: "apinex", kind: "daily_tokens", exhausted: true }
  if (/rate limit|\b429\b/i.test(s)) return { provider: "unknown", kind: "rpm", exhausted: true }
  if (/insufficient balance|402/i.test(s)) return { provider: "unknown", kind: "balance", exhausted: true }
  return null
}

export class Tracker {
  constructor(path = DEFAULT_STATE) {
    this.path = path
    this.state = { day: today(), providers: {}, history: [] }
    if (existsSync(path)) {
      try {
        const raw = JSON.parse(readFileSync(path, "utf8"))
        const history = Array.isArray(raw.history) ? raw.history : []
        if (raw.day === this.state.day) {
          this.state = { ...raw, history }
        } else if (raw.day) {
          this.state.history = [...history.filter((h) => h.day !== raw.day), { day: raw.day, providers: raw.providers || {} }]
        }
      } catch {}
    }
  }

  /** Record a failure that consumed or exhausted quota. */
  note(provider, kind, amount = 0) {
    const p = (this.state.providers[provider] ||= { tokensUsed: 0, failures: 0, exhausted: false, kinds: [] })
    p.failures += 1
    p.tokensUsed += amount
    p.exhausted = true
    if (!p.kinds.includes(kind)) p.kinds.push(kind)
    this.save()
    return p
  }

  /** Record normal usage (tokens spent). */
  spend(provider, tokens) {
    const p = (this.state.providers[provider] ||= { tokensUsed: 0, failures: 0, exhausted: false, kinds: [] })
    p.tokensUsed += tokens
    this.save()
    return p
  }

  /** Clear the exhausted flag (new UTC day, or after a top-up). */
  reset(provider) {
    const p = this.state.providers[provider]
    if (p) {
      p.exhausted = false
      p.failures = 0
    }
    this.save()
  }

  /** Опросить всех провайдеров и записать живое состояние. */
  async refresh(opts = {}) {
    const results = {}
    for (const provider of Object.keys(PROBES)) {
      const r = await probeProvider(provider, opts)
      results[provider] = r
      if (r.ok) {
        const p = (this.state.providers[provider] ||= {
          tokensUsed: 0,
          failures: 0,
          exhausted: false,
          kinds: [],
        })
        p.live = r
        if (r.exhausted) p.exhausted = true
      }
    }
    this.state.probedAt = Date.now()
    this.save()
    return results
  }

  /** Current status of every known provider. */
  status(now = new Date()) {
    const day = today(now)
    const out = []
    for (const [id, limit] of Object.entries(LIMITS)) {
      const p = this.state.providers[id] || { tokensUsed: 0, failures: 0, exhausted: false, kinds: [] }
      const left = limit.dailyTokens ? Math.max(0, limit.dailyTokens - p.tokensUsed) : null
      const ratio = limit.dailyTokens ? left / limit.dailyTokens : null
      const live = p.live
      out.push({
        provider: id,
        live: live ? { at: live.at, balanceUsd: live.balanceUsd, rpm: live.rpm, plan: live.plan } : null,
        tokensUsed: p.tokensUsed,
        dailyTokens: limit.dailyTokens,
        left,
        ratio,
        rpm: limit.rpm,
        exhausted: p.exhausted,
        kinds: p.kinds,
        warn: limit.dailyTokens ? ratio !== null && ratio < 0.2 && !p.exhausted : false,
      })
    }
    return { day, providers: out }
  }

  /** Plain-text warning for the agent (empty string when all good). */
  warning() {
    const s = this.status()
    const lines = []
    for (const p of s.providers) {
      if (p.exhausted) lines.push(`${p.provider}: exhausted (${p.kinds.join(", ") || "quota"}) — do not use it`)
      else if (p.warn) lines.push(`${p.provider}: only ${Math.round(p.ratio * 100)}% of the daily pool left`)
    }
    return lines.join("\n")
  }

  /** Export the ledger to a dashboard-friendly JSON array (one JSON object per day). */
  export(outPath, now = new Date()) {
    const byDay = new Map()
    if (outPath && existsSync(outPath)) {
      try {
        const existing = JSON.parse(readFileSync(outPath, "utf8"))
        if (Array.isArray(existing)) {
          for (const row of existing) {
            if (row?.day) byDay.set(row.day, row)
          }
        }
      } catch {}
    }
    for (const h of this.state.history || []) {
      if (h?.day) {
        const snap = this._buildDayObject(h.day, h.providers || {})
        byDay.set(h.day, snap)
      }
    }
    const current = this._buildDayObject(this.state.day || today(now), this.state.providers || {})
    byDay.set(current.day, current)
    const days = [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day))
    if (outPath) {
      mkdirSync(join(outPath, ".."), { recursive: true })
      writeFileSync(outPath, JSON.stringify(days, null, 2))
    }
    return days
  }

  _buildDayObject(day, providersMap) {
    const providers = []
    let totalTokensUsed = 0
    let exhaustedCount = 0
    const ids = new Set([...Object.keys(LIMITS), ...Object.keys(providersMap || {})])
    for (const id of ids) {
      const limit = LIMITS[id] || { dailyTokens: null, rpm: null }
      const p = providersMap[id] || { tokensUsed: 0, failures: 0, exhausted: false, kinds: [] }
      const left = limit.dailyTokens ? Math.max(0, limit.dailyTokens - p.tokensUsed) : null
      const ratio = limit.dailyTokens ? left / limit.dailyTokens : null
      const live = p.live
      totalTokensUsed += p.tokensUsed || 0
      if (p.exhausted) exhaustedCount += 1
      providers.push({
        provider: id,
        live: live ? { at: live.at, balanceUsd: live.balanceUsd, rpm: live.rpm, plan: live.plan } : null,
        tokensUsed: p.tokensUsed || 0,
        dailyTokens: limit.dailyTokens,
        left,
        ratio,
        rpm: limit.rpm,
        exhausted: Boolean(p.exhausted),
        kinds: p.kinds || [],
        warn: limit.dailyTokens ? ratio !== null && ratio < 0.2 && !p.exhausted : false,
      })
    }
    return {
      day,
      totalTokensUsed,
      exhaustedCount,
      providers,
    }
  }

  save() {
    try {
      mkdirSync(join(this.path, ".."), { recursive: true })
      writeFileSync(this.path, JSON.stringify(this.state, null, 2))
    } catch {}
  }
}
