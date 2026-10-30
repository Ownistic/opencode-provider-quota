import { afterEach, describe, expect, test } from "bun:test"
import { fetchQuota, parseQuota, QUOTA_URL, regenerationText, renewalText } from "../src/quota"

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

describe("weekly quota", () => {
  const subscription = { limit: 500, requests: 0 }
  test("uses the weekly values independently of subscription usage", () => {
    const weekly = parseQuota({ subscription, planWeeklyLimit: {
      percentRemaining: 66.01796194285714, nextRegenAt: "2026-10-30T02:27:29.000Z", nextRegenPercent: 2,
    } }).weekly!
    expect(weekly.percentRemaining.toFixed(2)).toBe("66.02")
    expect(regenerationText(weekly, Date.parse("2026-10-30T01:50:29Z"))).toBe("Regenerates 2% in 37 min")
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
