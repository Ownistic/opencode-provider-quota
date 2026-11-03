import { testRender } from "@opentui/solid"
import plugin from "../../src/tui"

let renderSidebar: (() => unknown) | undefined
const scenario = process.argv[2] || "both"
let request = 0
const timers: (() => void)[] = []
const originalSetInterval = globalThis.setInterval
if (scenario === "transition") {
  globalThis.setInterval = ((callback: TimerHandler, delay?: number, ...args: unknown[]) => {
    if (delay === 60000 && typeof callback === "function") timers.push(() => callback(...args))
    return originalSetInterval(callback, delay, ...args)
  }) as typeof setInterval
}
const rpc = {
  events: { on: () => () => {} },
  settings: async () => ({ syntheticRefreshSeconds: 60, codexRefreshSeconds: 60, showCodexResetDate: true, showSeconds: true, decimalPlaces: 2 }),
  get: async () => {
    if (scenario === "transition") {
      request++
      if (request === 2) return { status: "Temporary failure" }
      if (request === 3) return { status: "Not connected", unavailable: true }
    }
    return scenario === "neither" || scenario === "codex" ? { status: "Not connected", unavailable: true } : { status: "", quota: { weekly: { percentRemaining: 61.42, nextRegenAt: null, nextRegenPercent: null } } }
  },
  codex: async () => scenario === "neither" || scenario === "synthetic" || scenario === "transition" ? { status: "Not connected", unavailable: true } : { status: "", windows: [{ label: "5 hour", remainingPercent: 76, resetsAt: null }] },
}
const context = {
  options: {}, client: { rpc: () => rpc },
  keymap: { layer: () => {} },
  theme: { text: { base: "#ffffff", muted: "#888888" } },
  ui: { slot: ({ render }: { render: () => unknown }) => { renderSidebar = render; return () => {} } },
} as unknown as Parameters<typeof plugin.setup>[0]
const cleanup = await plugin.setup(context)
const screen = await testRender(() => renderSidebar!() as any, { width: 50, height: 20, useMouse: true })
try {
  if (scenario === "transition") {
    await screen.waitForFrame((frame) => frame.includes("Weekly remaining: 61.42%"))
    timers.forEach((tick) => tick())
    await screen.waitForFrame((frame) => frame.includes("Stale: Temporary failure") && frame.includes("61.42%"))
    timers.forEach((tick) => tick())
    await screen.waitForFrame((frame) => frame.includes("No quota providers connected") && !frame.includes("61.42%"))
    timers.forEach((tick) => tick())
    await screen.waitForFrame((frame) => frame.includes("Weekly remaining: 61.42%") && !frame.includes("Stale"))
  } else if (scenario !== "both") {
    const expected = scenario === "neither" ? "No quota providers connected" : scenario === "codex" ? "Codex quota" : "Synthetic quota"
    const frame = await screen.waitForFrame((value) => value.includes(expected) && !value.includes("Checking providers"))
    if (scenario !== "synthetic" && frame.includes("Synthetic quota")) throw new Error("Unexpected Synthetic provider")
    if (scenario !== "codex" && frame.includes("Codex quota")) throw new Error("Unexpected Codex provider")
  } else {
  await screen.waitForFrame((frame) => frame.includes("Synthetic quota") && frame.includes("Codex quota"))
  await screen.mockMouse.click(2, 1)
  await screen.waitForFrame((frame) => frame.includes("Synthetic: 61.42%"))
  await screen.mockMouse.click(2, 2)
  await screen.waitForFrame((frame) => frame.includes("Synthetic quota") && frame.includes("Codex quota"))
  await screen.mockMouse.drag(2, 1, 8, 1)
  await screen.renderOnce()
  if (!screen.captureCharFrame().includes("Synthetic quota")) throw new Error("Dragging toggled the quota view")
  }
} finally {
  globalThis.setInterval = originalSetInterval
  cleanup?.()
  await screen.dispose()
}
