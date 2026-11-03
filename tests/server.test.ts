import { afterEach, expect, test } from "bun:test"
import plugin from "../src/index"

const originalFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = originalFetch })

test("uses the configured Codex executable for quota requests", async () => {
  let handlers: Record<string, (...args: any[]) => Promise<any>> = {}
  const context = {
    options: { codexCommand: new URL("./fixtures/codex-mock.js", import.meta.url).pathname },
    storage: { get: async () => undefined, set: async () => {} },
    rpc: { register: async (_definition: unknown, methods: typeof handlers) => {
      handlers = methods
      return { dispose: async () => {}, events: { emit: async () => {} } }
    } },
  } as unknown as Parameters<typeof plugin.setup>[0]
  await plugin.setup(context)
  const result = await handlers.codex({}, { signal: AbortSignal.timeout(3000) })
  expect(result.status).toBe("")
  expect(result.windows.map((window: { remainingPercent: number }) => window.remainingPercent)).toEqual([75, 25])
})

test("resolves the active Synthetic key on the server and returns only quota data", async () => {
  let handler: ((input: unknown, context: { signal: AbortSignal }) => Promise<unknown>) | undefined
  const connection = { source: "test" }
  const context = {
    options: {},
    storage: { get: async () => undefined, set: async () => {} },
    integration: { connection: {
      active: async (id: string) => { expect(id).toBe("synthetic"); return connection },
      resolve: async (value: unknown) => { expect(value).toBe(connection); return { type: "key", key: "private-test-key" } },
    } },
    rpc: { register: async (_definition: unknown, handlers: { get: typeof handler }) => {
      handler = handlers.get
      return { dispose: async () => {}, events: { emit: async () => {} } }
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

test("marks Synthetic as unavailable when no connection is configured", async () => {
  let handlers: Record<string, (...args: any[]) => Promise<any>> = {}
  const context = {
    options: {}, storage: { get: async () => undefined },
    integration: { connection: { active: async () => undefined } },
    rpc: { register: async (_definition: unknown, methods: typeof handlers) => { handlers = methods; return { dispose: async () => {}, events: { emit: async () => {} } } } },
  } as unknown as Parameters<typeof plugin.setup>[0]
  await plugin.setup(context)
  expect(await handlers.get({}, { signal: new AbortController().signal })).toEqual({ status: "Connect Synthetic in OpenCode", unavailable: true })
})

test("persists refresh settings, publishes changes, and restores them on setup", async () => {
  const saved = new Map<string, unknown>()
  let handlers: Record<string, (...args: any[]) => Promise<any>> = {}
  const emitted: unknown[] = []
  const context = {
    options: { refreshSeconds: 45 },
    storage: { get: async (key: string) => saved.get(key), set: async (key: string, value: unknown) => { saved.set(key, value) } },
    rpc: { register: async (_definition: unknown, methods: typeof handlers) => {
      handlers = methods
      return { dispose: async () => {}, events: { emit: async (name: string, value: unknown) => { emitted.push([name, value]) } } }
    } },
  } as unknown as Parameters<typeof plugin.setup>[0]
  await plugin.setup(context)
  const initial = { refreshSeconds: 45, syntheticRefreshSeconds: 45, codexRefreshSeconds: 45, showCodexResetDate: true, showSeconds: true, decimalPlaces: 2 }
  expect(await handlers.settings()).toEqual(initial)
  const legacy = { ...initial, refreshSeconds: 25, syntheticRefreshSeconds: 25, codexRefreshSeconds: 25 }
  expect(await handlers.configure({ refreshSeconds: 25 })).toEqual(legacy)
  expect(await handlers.setProviderRefresh({ provider: "codex", refreshSeconds: 90 })).toEqual({ ...legacy, codexRefreshSeconds: 90 })
  expect(await handlers.setCodexResetDate({ show: false })).toEqual({ ...legacy, codexRefreshSeconds: 90, showCodexResetDate: false })
  const withoutSeconds = { ...legacy, codexRefreshSeconds: 90, showCodexResetDate: false, showSeconds: false }
  expect(await handlers.setShowSeconds({ show: false })).toEqual(withoutSeconds)
  const final = { ...withoutSeconds, decimalPlaces: 0 }
  expect(await handlers.setDecimalPlaces({ decimalPlaces: 0 })).toEqual(final)
  expect(saved.get("refreshSeconds")).toBe(25)
  expect(saved.get("decimalPlaces")).toBe(0)
  expect(emitted).toEqual([["settingsChanged", legacy], ["settingsChanged", { ...legacy, codexRefreshSeconds: 90 }], ["settingsChanged", { ...legacy, codexRefreshSeconds: 90, showCodexResetDate: false }], ["settingsChanged", withoutSeconds], ["settingsChanged", final]])
  await expect(handlers.configure({ refreshSeconds: 1 })).rejects.toThrow()
  await expect(handlers.setProviderRefresh({ provider: "other", refreshSeconds: 30 })).rejects.toThrow()
  await expect(handlers.setProviderRefresh({ provider: "codex", refreshSeconds: 1 })).rejects.toThrow()
  await expect(handlers.setCodexResetDate({ show: "false" })).rejects.toThrow()
  await expect(handlers.setShowSeconds({ show: "false" })).rejects.toThrow()
  for (const decimalPlaces of [-1, 7, 1.5, NaN]) await expect(handlers.setDecimalPlaces({ decimalPlaces })).rejects.toThrow()
  await plugin.setup(context)
  expect(await handlers.settings()).toEqual(final)
})

test("migrates the saved legacy interval independently and honors new defaults", async () => {
  const saved = new Map<string, unknown>([["refreshSeconds", 35], ["syntheticRefreshSeconds", 20]])
  let handlers: Record<string, (...args: any[]) => Promise<any>> = {}
  const context = {
    options: { syntheticRefreshSeconds: 15, codexRefreshSeconds: 80, showCodexResetDate: false },
    storage: { get: async (key: string) => saved.get(key), set: async (key: string, value: unknown) => { saved.set(key, value) } },
    rpc: { register: async (_definition: unknown, methods: typeof handlers) => { handlers = methods; return { dispose: async () => {}, events: { emit: async () => {} } } } },
  } as unknown as Parameters<typeof plugin.setup>[0]
  await plugin.setup(context)
  expect(await handlers.settings()).toEqual({ refreshSeconds: 35, syntheticRefreshSeconds: 20, codexRefreshSeconds: 35, showCodexResetDate: false, showSeconds: true, decimalPlaces: 2 })
  saved.clear()
  await plugin.setup(context)
  expect(await handlers.settings()).toEqual({ refreshSeconds: 60, syntheticRefreshSeconds: 15, codexRefreshSeconds: 80, showCodexResetDate: false, showSeconds: true, decimalPlaces: 2 })
})
