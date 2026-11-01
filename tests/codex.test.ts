import { expect, test } from "bun:test"
import { fetchCodexQuota, parseCodexQuota } from "../src/codex"

test("parses Codex windows and prefers the codex bucket", () => {
  expect(parseCodexQuota({ rateLimits: { primary: { usedPercent: 99 } }, rateLimitsByLimitId: { codex: {
    primary: { usedPercent: 25, windowDurationMins: 300, resetsAt: 1730947200 },
    secondary: { usedPercent: 75, windowDurationMins: 10080, resetsAt: null },
  } } })).toEqual([
    { label: "5 hour", remainingPercent: 75, resetsAt: "2024-11-07T02:40:00.000Z" },
    { label: "1 week", remainingPercent: 25, resetsAt: null },
  ])
})

test("does not invent absent or invalid quota windows", () => {
  for (const data of [null, {}, { rateLimits: {} }, { rateLimits: { primary: { usedPercent: 101 } } }]) {
    expect(() => parseCodexQuota(data)).toThrow()
  }
  expect(parseCodexQuota({ rateLimits: { secondary: { usedPercent: 0, resetsAt: 1e40 } } })).toEqual([
    { label: "Secondary", remainingPercent: 100, resetsAt: null },
  ])
})

test("performs the initialization handshake with a CLI process", async () => {
  const windows = await fetchCodexQuota(AbortSignal.timeout(3000), new URL("./fixtures/codex-mock.js", import.meta.url).pathname)
  expect(windows.map((window) => window.remainingPercent)).toEqual([75, 25])
})

test("reports missing CLI and cancellation without leaking process output", async () => {
  await expect(fetchCodexQuota(AbortSignal.timeout(3000), "/does-not-exist/codex")).rejects.toThrow("Could not start Codex CLI")
  await expect(fetchCodexQuota(AbortSignal.abort())).rejects.toThrow("cancelled")
})
