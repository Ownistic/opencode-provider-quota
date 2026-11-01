export const QUOTA_URL = "https://api.synthetic.new/v2/quotas"

export class QuotaError extends Error {}

export interface Quota {
  limit: number
  requests: number
  renewsAt: string | null
  remainingPercent: number
  weekly?: WeeklyQuota
}

export interface WeeklyQuota {
  percentRemaining: number
  nextRegenAt: string | null
  nextRegenPercent: number | null
}

export function parseQuota(data: unknown): Quota {
  if (!data || typeof data !== "object" || !("subscription" in data)) throw new QuotaError("Invalid quota response")
  const subscription = data.subscription
  if (!subscription || typeof subscription !== "object") throw new QuotaError("Subscription quota unavailable")
  const { limit, requests, renewsAt } = subscription as Record<string, unknown>
  if (typeof limit !== "number" || !Number.isFinite(limit) || limit <= 0 ||
      typeof requests !== "number" || !Number.isFinite(requests) || requests < 0) {
    throw new QuotaError("Invalid subscription quota")
  }
  const weeklyData = "planWeeklyLimit" in data && data.planWeeklyLimit && typeof data.planWeeklyLimit === "object"
    ? data.planWeeklyLimit as Record<string, unknown> : undefined
  const percent = weeklyData?.percentRemaining
  const regenPercent = weeklyData?.nextRegenPercent
  const nextRegenAt = weeklyData?.nextRegenAt
  const weekly = typeof percent === "number" && Number.isFinite(percent) && percent >= 0 && percent <= 100
    ? {
        percentRemaining: percent,
        nextRegenAt: typeof nextRegenAt === "string" && Number.isFinite(Date.parse(nextRegenAt)) ? nextRegenAt : null,
        nextRegenPercent: typeof regenPercent === "number" && Number.isFinite(regenPercent) && regenPercent >= 0 && regenPercent <= 100 ? regenPercent : null,
      }
    : undefined
  return {
    limit, requests,
    renewsAt: typeof renewsAt === "string" && Number.isFinite(Date.parse(renewsAt)) ? renewsAt : null,
    remainingPercent: Math.max(0, Math.min(100, (1 - requests / limit) * 100)),
    ...(weekly ? { weekly } : {}),
  }
}

export function regenerationText(weekly: WeeklyQuota, now = Date.now()): string {
  if (!weekly.nextRegenAt || weekly.nextRegenPercent === null) return "Regeneration details unavailable"
  const seconds = Math.ceil((Date.parse(weekly.nextRegenAt) - now) / 1000)
  if (seconds <= 0) return "Regeneration due; waiting for update"
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor(seconds % 86400 / 3600)
  const minutes = Math.floor(seconds % 3600 / 60)
  const remaining = [days ? `${days}d` : "", (days || hours) ? `${hours}h` : "", (days || hours || minutes) ? `${minutes}m` : "", `${seconds % 60}s`].filter(Boolean).join(" ")
  return `Regenerates ${weekly.nextRegenPercent}% in ${remaining}`
}

export function renewalText(renewsAt: string | null, now = Date.now()): string {
  if (!renewsAt) return "Renewal time unavailable"
  const minutes = Math.ceil((Date.parse(renewsAt) - now) / 60_000)
  if (minutes <= 0) return "Renewal due; waiting for update"
  if (minutes < 60) return `Renews in ${minutes} min`
  const hours = Math.floor(minutes / 60)
  const remaining = minutes % 60
  if (hours < 24) return `Renews in ${hours}h${remaining ? ` ${remaining}m` : ""}`
  const days = Math.floor(hours / 24)
  return `Renews in ${days}d ${hours % 24}h`
}

export function resetText(resetsAt: string | null, now = Date.now(), showDate = true): string {
  if (!resetsAt || !Number.isFinite(Date.parse(resetsAt))) return "Reset time unavailable"
  const date = new Date(resetsAt)
  const exact = date.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit", timeZoneName: "short" })
  const seconds = Math.ceil((date.getTime() - now) / 1000)
  if (seconds <= 0) return `Reset due${showDate ? ` (${exact})` : ""}; waiting for update`
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor(seconds % 86400 / 3600)
  const minutes = Math.floor(seconds % 3600 / 60)
  const remaining = [days ? `${days}d` : "", (days || hours) ? `${hours}h` : "", `${minutes}m`, `${seconds % 60}s`].filter(Boolean).join(" ")
  return `Resets in ${remaining}${showDate ? ` (${exact})` : ""}`
}

export function codexPercent(value: number, digits: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(digits)
}

// HSL hue from red through yellow to green, returned as hex for both UI renderers.
export function quotaColor(percent: number): string {
  const hue = Math.max(0, Math.min(100, Number.isFinite(percent) ? percent : 0)) * 1.2
  const chroma = (1 - Math.abs(2 * 0.45 - 1)) * 0.75
  const x = chroma * (1 - Math.abs((hue / 60) % 2 - 1))
  const m = 0.45 - chroma / 2
  const rgb = hue < 60 ? [chroma, x, 0] : [x, chroma, 0]
  return `#${rgb.map((channel) => Math.round((channel + m) * 255).toString(16).padStart(2, "0")).join("")}`
}

export async function fetchQuota(key: string, signal?: AbortSignal): Promise<Quota> {
  const response = await fetch(QUOTA_URL, {
    headers: { Authorization: `Bearer ${key}` },
    redirect: "error",
    signal,
  })
  if (response.status === 401 || response.status === 403) throw new QuotaError("API key rejected")
  if (!response.ok) throw new QuotaError(`Quota request failed (HTTP ${response.status})`)
  return parseQuota(await response.json())
}
