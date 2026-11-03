import { testRender } from "@opentui/solid"
import plugin from "../../src/tui"

let renderSidebar: (() => unknown) | undefined
const rpc = {
  events: { on: () => () => {} },
  settings: async () => ({ syntheticRefreshSeconds: 60, codexRefreshSeconds: 60, showCodexResetDate: true, showSeconds: true, decimalPlaces: 2 }),
  get: async () => ({ status: "", quota: { weekly: { percentRemaining: 61.42, nextRegenAt: null, nextRegenPercent: null } } }),
  codex: async () => ({ status: "", windows: [{ label: "5 hour", remainingPercent: 76, resetsAt: null }] }),
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
  await screen.waitForFrame((frame) => frame.includes("Synthetic quota") && frame.includes("Codex quota"))
  await screen.mockMouse.click(2, 1)
  await screen.waitForFrame((frame) => frame.includes("Synthetic: 61.42%"))
  await screen.mockMouse.click(2, 2)
  await screen.waitForFrame((frame) => frame.includes("Synthetic quota") && frame.includes("Codex quota"))
  await screen.mockMouse.drag(2, 1, 8, 1)
  await screen.renderOnce()
  if (!screen.captureCharFrame().includes("Synthetic quota")) throw new Error("Dragging toggled the quota view")
} finally {
  cleanup?.()
  await screen.dispose()
}
