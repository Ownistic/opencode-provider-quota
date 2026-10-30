import { afterEach, expect, test } from "bun:test"
import plugin from "../src/index"

const originalFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = originalFetch })

test("resolves the active Synthetic key on the server and returns only quota data", async () => {
  let handler: ((input: unknown, context: { signal: AbortSignal }) => Promise<unknown>) | undefined
  const connection = { source: "test" }
  const context = {
    integration: { connection: {
      active: async (id: string) => { expect(id).toBe("synthetic"); return connection },
      resolve: async (value: unknown) => { expect(value).toBe(connection); return { type: "key", key: "private-test-key" } },
    } },
    rpc: { register: async (_definition: unknown, handlers: { get: typeof handler }) => {
      handler = handlers.get
      return { dispose: async () => {} }
    } },
  } as unknown as Parameters<typeof plugin.setup>[0]
  globalThis.fetch = (async (_input, init) => {
    expect(init?.headers).toEqual({ Authorization: "Bearer private-test-key" })
    return Response.json({ subscription: { limit: 100, requests: 25 }, planWeeklyLimit: { percentRemaining: 66, nextRegenAt: "2026-10-30T02:27:29.000Z", nextRegenPercent: 2 } })
  }) as typeof fetch
  await plugin.setup(context)
  const result = await handler!({}, { signal: new AbortController().signal })
  expect(result).toEqual({ status: "", quota: { limit: 100, requests: 25, renewsAt: null, remainingPercent: 75, weekly: { percentRemaining: 66, nextRegenAt: "2026-10-30T02:27:29.000Z", nextRegenPercent: 2 } } })
  expect(JSON.stringify(result)).not.toContain("private-test-key")
})
