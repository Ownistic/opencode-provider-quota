import { afterEach, describe, expect, test } from "bun:test"
import { codexPercent, compactQuotaText, fetchQuota, parseQuota, quotaColor, QUOTA_URL, regenerationText, renewalText, resetText } from "../src/quota"

describe("subscription quota", () => {
  test("calculates and clamps remaining percentage", () => {
    expect(parseQuota({ subscription: { limit: 200, requests: 68, renewsAt: "2025-09-21T14:36:14.288Z" } }).remainingPercent).toBeCloseTo(66)
    expect(parseQuota({ subscription: { limit: 10, requests: 20 } }).remainingPercent).toBe(0)
  })
  test("rejects missing, invalid, and zero limits", () => {
    for (const subscription of [null, {}, { limit: 0, requests: 0 }, { limit: 10, requests: -1 }, { limit: 10, requests: NaN }]) {
      expect(() => parseQuota({ subscription })).toThrow()
    }
  })
  test("handles absent, future, and overdue renewal times", () => {
    const now = Date.parse("2025-09-21T14:00:00Z")
    expect(parseQuota({ subscription: { limit: 1, requests: 0, renewsAt: "bad" } }).renewsAt).toBeNull()
    expect(renewalText(null, now)).toBe("Renewal time unavailable")
    expect(renewalText("2025-09-21T14:37:00Z", now)).toBe("Renews in 37 min")
    expect(renewalText("2025-09-22T15:00:00Z", now)).toBe("Renews in 1d 1h")
    expect(renewalText("2025-09-21T13:00:00Z", now)).toBe("Renewal due; waiting for update")
  })
})

test("formats Codex reset countdowns with seconds and a local exact timestamp", () => {
  const timestamp = "2025-09-22T15:00:05Z"
  const exact = new Date(timestamp).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit", timeZoneName: "short" })
  expect(resetText(timestamp, Date.parse("2025-09-21T14:00:00Z"))).toBe(`Resets in 1d 1h 0m 5s (${exact})`)
  expect(resetText(timestamp, Date.parse(timestamp))).toBe(`Reset due (${exact}); waiting for update`)
  expect(resetText(timestamp, Date.parse("2025-09-21T14:00:00Z"), false)).toBe("Resets in 1d 1h 0m 5s")
  expect(resetText(timestamp, Date.parse(timestamp), false)).toBe("Reset due; waiting for update")
  const minuteDate = new Date(timestamp).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" })
  expect(resetText(timestamp, Date.parse("2025-09-22T15:00:04Z"), true, false)).toBe(`Resets in 1m (${minuteDate})`)
  expect(resetText(timestamp, Date.parse("2025-09-22T14:00:04Z"), false, false)).toBe("Resets in 1h 1m")
  expect(resetText(null)).toBe("Reset time unavailable")
  expect(resetText("bad")).toBe("Reset time unavailable")
})

test("does not pad whole Codex percentages with decimals", () => {
  expect(codexPercent(75, 2)).toBe("75")
  expect(codexPercent(75.25, 2)).toBe("75.25")
  expect(codexPercent(75.25, 1)).toBe("75.3")
})

test("compact quota text retains missing and stale states", () => {
  expect(compactQuotaText("Synthetic", "61.42", "")).toBe("Synthetic: 61.42%")
  expect(compactQuotaText("Codex", "76", "")).toBe("Codex: 76%")
  expect(compactQuotaText("Codex 5 hour", "76", "Request failed")).toBe("Codex 5 hour: 76% (stale: Request failed)")
  expect(compactQuotaText("Synthetic", undefined, "")).toBe("Synthetic: Quota unavailable")
  expect(compactQuotaText("Codex", undefined, "Loading quota…")).toBe("Codex: Loading quota…")
})

test("colors quota from red through yellow to green and clamps invalid values", () => {
  expect(quotaColor(0)).toBe("#c91d1d")
  expect(quotaColor(50)).toBe("#c9c91d")
  expect(quotaColor(100)).toBe("#1dc91d")
  expect(quotaColor(-5)).toBe(quotaColor(0))
  expect(quotaColor(105)).toBe(quotaColor(100))
  expect(quotaColor(NaN)).toBe(quotaColor(0))
  expect(quotaColor(25)).not.toBe(quotaColor(50))
})

describe("weekly quota", () => {
  const subscription = { limit: 500, requests: 0 }
  test("uses the weekly values independently of subscription usage", () => {
    const weekly = parseQuota({ subscription, planWeeklyLimit: {
      percentRemaining: 66.01796194285714, nextRegenAt: "2026-10-30T02:27:29.000Z", nextRegenPercent: 2,
    } }).weekly!
    expect(weekly.percentRemaining.toFixed(2)).toBe("66.02")
    expect(regenerationText(weekly, Date.parse("2026-10-30T01:50:29Z"))).toBe("Regenerates 2% in 37m 0s")
    expect(regenerationText(weekly, Date.parse("2026-10-30T01:25:22Z"))).toBe("Regenerates 2% in 1h 2m 7s")
    expect(regenerationText(weekly, Date.parse("2026-10-30T02:27:28.500Z"))).toBe("Regenerates 2% in 1s")
    expect(regenerationText(weekly, Date.parse("2026-10-30T02:27:28.500Z"), false)).toBe("Regenerates 2% in 1m")
    expect(regenerationText(weekly, Date.parse("2026-10-30T01:25:22Z"), false)).toBe("Regenerates 2% in 1h 3m")
    expect(regenerationText(weekly, Date.parse("2026-10-29T01:25:22Z"))).toBe("Regenerates 2% in 1d 1h 2m 7s")
    expect(regenerationText(weekly, Date.parse("2026-10-30T02:27:29Z"))).toBe("Regeneration due; waiting for update")
    expect(regenerationText(weekly, Date.parse("2026-10-30T02:28:00Z"))).toBe("Regeneration due; waiting for update")
  })
  test("handles missing and invalid fields without inventing weekly data", () => {
    expect(parseQuota({ subscription }).weekly).toBeUndefined()
    for (const value of [null, -1, 101, NaN, "66"]) {
      expect(parseQuota({ subscription, planWeeklyLimit: { percentRemaining: value } }).weekly).toBeUndefined()
    }
    const weekly = parseQuota({ subscription, planWeeklyLimit: { percentRemaining: 50, nextRegenAt: "bad", nextRegenPercent: null } }).weekly!
    expect(regenerationText(weekly)).toBe("Regeneration details unavailable")
  })
})

describe("quota request", () => {
  const originalFetch = globalThis.fetch
  afterEach(() => { globalThis.fetch = originalFetch })
  test("uses the documented endpoint and bearer authentication", async () => {
    globalThis.fetch = (async (input, init) => {
      expect(input).toBe(QUOTA_URL)
      expect(init?.headers).toEqual({ Authorization: "Bearer test-key" })
      expect(init?.redirect).toBe("error")
      return Response.json({ subscription: { limit: 100, requests: 25 } })
    }) as typeof fetch
    expect((await fetchQuota("test-key")).remainingPercent).toBe(75)
  })
  test("does not expose an error response body", async () => {
    globalThis.fetch = (async () => new Response("secret response", { status: 401 })) as unknown as typeof fetch
    await expect(fetchQuota("test-key")).rejects.toThrow("API key rejected")
  })
})
