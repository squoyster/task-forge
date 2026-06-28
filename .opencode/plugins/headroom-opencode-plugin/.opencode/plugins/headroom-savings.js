// Headroom Savings Monitor for OpenCode
// Polls Headroom /stats and keeps a compact savings status available to OpenCode.
//
// Install:
//   cp -R .opencode ./
//   export HEADROOM_STATS_URL=http://127.0.0.1:8787/stats
//   opencode
//
// Outputs:
//   .opencode/headroom-status.txt   plain one-line status
//   .opencode/headroom-status.ansi  ANSI-colored one-line status
//   .opencode/headroom-status.json  normalized stats summary
//
// Also adds custom tool: headroom_savings

import { tool } from "@opencode-ai/plugin"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

const ANSI = {
  reset: "\x1b[0m",
  gray: "\x1b[90m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  green: "\x1b[32m",
  cyan: "\x1b[36m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  bold: "\x1b[1m",
}

function num(value, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {}
}

function compactInt(n) {
  n = Math.round(num(n))
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}m`
  if (abs >= 1_000) return `${(n / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}k`
  return String(n)
}

function money(n) {
  n = num(n)
  if (Math.abs(n) < 0.005) return "$0"
  if (Math.abs(n) < 1) return `$${n.toFixed(3)}`
  return `$${n.toFixed(2)}`
}

function pct(n) {
  n = num(n)
  if (Math.abs(n) < 0.05) return "0%"
  if (Math.abs(n) < 10) return `${n.toFixed(1)}%`
  return `${Math.round(n)}%`
}

function summarizeStats(raw, err = null) {
  if (err) {
    return {
      ok: false,
      level: "offline",
      status: "offline",
      error: String(err?.message || err),
      plain: "HR offline",
      ansi: `${ANSI.red}${ANSI.bold}HR offline${ANSI.reset}`,
      markdown: "**Headroom:** offline",
    }
  }

  const tokens = object(raw.tokens)
  const cost = object(raw.cost)
  const display = object(raw.display_session)
  const persistent = object(raw.persistent_savings)
  const prefix = object(raw.prefix_cache)
  const prefixTotals = object(prefix.totals)
  const inbound = object(raw.proxy_inbound)
  const byStatus = object(inbound.by_status)
  const byPath = object(inbound.by_path)
  const contextTool = object(raw.context_tool)

  const saved = num(tokens.saved)
  const proxySaved = num(tokens.proxy_compression_saved)
  const cliSaved = num(tokens.cli_filtering_saved || tokens.rtk_saved)
  const pctSaved = num(tokens.savings_percent || tokens.all_layers_savings_percent || display.savings_percent)
  const dollars = num(cost.savings_usd || display.compression_savings_usd)
  const cacheDollars = num(cost.cache_savings_usd || prefixTotals.net_savings_usd || prefixTotals.savings_usd)
  const requests = num(display.requests || inbound.total)
  const totalInput = num(display.total_input_tokens || tokens.input)
  const status200 = num(byStatus["200"])
  const status401 = num(byStatus["401"])
  const status404 = num(byStatus["404"])
  const responsesPath = num(byPath["/responses"])
  const chatPath = num(byPath["/chat/completions"])
  const rtkAvailable = Boolean(contextTool.available)

  const problems = []
  if (status404 > 0) problems.push(`404×${status404}`)
  if (status401 > 0) problems.push(`401×${status401}`)
  if (responsesPath > 0) problems.push(`resp×${responsesPath}`)

  let level = "idle"
  if (status401 > 0 || status404 > 0 || responsesPath > 0) level = "warn"
  if (saved > 0 || dollars > 0 || cacheDollars > 0) level = "saving"
  if (pctSaved >= 20 || saved >= 10_000) level = "high"

  let parts = [`HR`, `${compactInt(saved)}tok`, pct(pctSaved), money(dollars)]
  if (cacheDollars > 0) parts.push(`cache ${money(cacheDollars)}`)
  if (cliSaved > 0) parts.push(`rtk ${compactInt(cliSaved)}`)
  if (problems.length > 0) parts.push(problems.join(" "))
  else parts.push("OK")

  const plain = parts.join(" ")

  let color = ANSI.gray
  if (level === "warn") color = ANSI.yellow
  if (level === "saving") color = ANSI.green
  if (level === "high") color = ANSI.cyan + ANSI.bold

  const ansi = `${color}${plain}${ANSI.reset}`

  const markdown = [
    `**${plain}**`,
    `- requests: ${requests}`,
    `- chat completions: ${chatPath}`,
    `- saved: ${compactInt(saved)} tokens (${pct(pctSaved)})`,
    `- proxy compression: ${compactInt(proxySaved)} tokens`,
    `- RTK/CLI filtering: ${compactInt(cliSaved)} tokens (${rtkAvailable ? "available" : "not installed"})`,
    `- dollars saved: ${money(dollars)}; cache: ${money(cacheDollars)}`,
    `- status: 200×${status200} 404×${status404} 401×${status401}`,
    `- input tokens: ${compactInt(totalInput)}`,
  ].join("\n")

  return {
    ok: true,
    level,
    status: level,
    plain,
    ansi,
    markdown,
    values: {
      requests,
      chatPath,
      responsesPath,
      saved,
      proxySaved,
      cliSaved,
      pctSaved,
      dollars,
      cacheDollars,
      totalInput,
      status200,
      status401,
      status404,
      rtkAvailable,
    },
    sampledAt: new Date().toISOString(),
  }
}

async function fetchJson(url, timeoutMs) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new Error("timeout")), timeoutMs)
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { accept: "application/json" },
      signal: controller.signal,
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

async function writeOutputs(outDir, summary) {
  await mkdir(outDir, { recursive: true })
  await writeFile(path.join(outDir, "headroom-status.txt"), summary.plain + "\n", "utf8")
  await writeFile(path.join(outDir, "headroom-status.ansi"), summary.ansi + "\n", "utf8")
  await writeFile(path.join(outDir, "headroom-status.json"), JSON.stringify(summary, null, 2) + "\n", "utf8")
}

export const HeadroomSavingsPlugin = async ({ client, directory }) => {
  const url = process.env.HEADROOM_STATS_URL || "http://127.0.0.1:8787/stats"
  const intervalMs = Number(process.env.HEADROOM_STATS_INTERVAL_MS || 45000)
  const timeoutMs = Number(process.env.HEADROOM_STATS_TIMEOUT_MS || 1500)
  const outDir = process.env.HEADROOM_STATUS_DIR || path.join(directory, ".opencode")

  let latest = summarizeStats(null, new Error("not sampled yet"))
  let previousPlain = ""
  let timer = null

  async function sample(reason = "timer") {
    try {
      const raw = await fetchJson(url, timeoutMs)
      latest = summarizeStats(raw)
    } catch (err) {
      latest = summarizeStats(null, err)
    }

    await writeOutputs(outDir, latest)

    // Avoid chat/TUI spam. Log only on state-string changes.
    if (latest.plain !== previousPlain) {
      previousPlain = latest.plain
      try {
        await client.app.log({
          body: {
            service: "headroom-savings",
            level: latest.ok ? (latest.level === "warn" ? "warn" : "info") : "error",
            message: latest.plain,
            extra: { reason, url, values: latest.values || {}, error: latest.error || null },
          },
        })
      } catch {
        // client logging is best-effort only
      }
    }

    return latest
  }

  await sample("startup")
  timer = setInterval(() => void sample("interval"), Math.max(5000, intervalMs))
  if (timer.unref) timer.unref()

  return {
    event: async ({ event }) => {
      if (event?.type === "server.connected" || event?.type === "session.idle") {
        await sample(event.type)
      }
    },

    tool: {
      headroom_savings: tool({
        description: "Show compact Headroom token/cost savings status from the local /stats endpoint.",
        args: {},
        async execute() {
          const current = await sample("tool")
          return current.markdown
        },
      }),
    },
  }
}
