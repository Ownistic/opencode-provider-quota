import { spawn } from "node:child_process"
import { createInterface } from "node:readline"
import { QuotaError } from "./quota"

export interface CodexWindow {
  label: string
  remainingPercent: number
  resetsAt: string | null
}

export function parseCodexQuota(data: unknown): CodexWindow[] {
  if (!data || typeof data !== "object") throw new QuotaError("Codex quota unavailable")
  const result = data as Record<string, any>
  const bucket = result.rateLimitsByLimitId?.codex ?? result.rateLimits
  if (!bucket || typeof bucket !== "object") throw new QuotaError("Codex quota unavailable; sign in with ChatGPT")
  const windows: CodexWindow[] = []
  for (const [key, fallback] of [["primary", "Primary"], ["secondary", "Secondary"]] as const) {
    const window = bucket[key]
    if (!window || typeof window !== "object" || typeof window.usedPercent !== "number" || !Number.isFinite(window.usedPercent) || window.usedPercent < 0 || window.usedPercent > 100) continue
    const duration = window.windowDurationMins
    const label = typeof duration === "number" && Number.isFinite(duration) && duration > 0
      ? duration % 10080 === 0 ? `${duration / 10080} week` : duration % 1440 === 0 ? `${duration / 1440} day` : duration % 60 === 0 ? `${duration / 60} hour` : `${duration} minute`
      : fallback
    const timestamp = typeof window.resetsAt === "number" ? window.resetsAt * 1000 : NaN
    windows.push({ label, remainingPercent: 100 - window.usedPercent, resetsAt: Number.isFinite(timestamp) && Math.abs(timestamp) <= 8640000000000000 ? new Date(timestamp).toISOString() : null })
  }
  if (!windows.length) throw new QuotaError("Codex quota unavailable; sign in with ChatGPT")
  return windows
}

export function fetchCodexQuota(signal: AbortSignal, command = "codex"): Promise<CodexWindow[]> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new QuotaError("Codex quota request timed out or cancelled"))
    const child = spawn(command, ["app-server"], { stdio: ["pipe", "pipe", "ignore"], windowsHide: true })
    const lines = createInterface({ input: child.stdout })
    let settled = false
    const finish = (error?: Error, value?: CodexWindow[]) => {
      if (settled) return
      settled = true
      signal.removeEventListener("abort", abort)
      lines.close()
      child.stdin.destroy()
      child.kill()
      if (error) reject(error)
      else resolve(value!)
    }
    const abort = () => finish(new QuotaError("Codex quota request timed out or cancelled"))
    signal.addEventListener("abort", abort, { once: true })
    child.on("error", () => finish(new QuotaError("Could not start Codex CLI")))
    child.stdin.on("error", () => finish(new QuotaError("Codex CLI communication failed")))
    child.on("close", () => finish(new QuotaError("Codex CLI exited before returning quota")))
    lines.on("line", (line) => {
      if (line.length > 1_000_000) return finish(new QuotaError("Invalid Codex response"))
      let message: any
      try { message = JSON.parse(line) } catch { return finish(new QuotaError("Invalid Codex response")) }
      if (!message || typeof message !== "object") return finish(new QuotaError("Invalid Codex response"))
      if (message.id === 1) {
        if (message.error || !message.result) return finish(new QuotaError("Codex initialization failed"))
        child.stdin.write(JSON.stringify({ method: "initialized" }) + "\n")
        child.stdin.write(JSON.stringify({ id: 2, method: "account/rateLimits/read" }) + "\n")
      } else if (message.id === 2) {
        if (message.error) return finish(new QuotaError("Codex quota unavailable; sign in with ChatGPT"))
        try { finish(undefined, parseCodexQuota(message.result)) } catch (error) { finish(error as Error) }
      }
    })
    child.stdin.write(JSON.stringify({ id: 1, method: "initialize", params: { clientInfo: { name: "opencode_quota", title: "OpenCode quota", version: "0.1.0" } } }) + "\n")
  })
}
