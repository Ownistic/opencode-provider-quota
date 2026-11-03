import { expect, test } from "bun:test"

test("clicking the quota view toggles compact mode in both directions", () => {
  const result = Bun.spawnSync([process.execPath, "--preload", "@opentui/solid/preload", "tests/fixtures/tui-toggle.tsx"], { stdout: "pipe", stderr: "pipe" })
  expect(result.exitCode, result.stderr.toString()).toBe(0)
}, 15000)

for (const scenario of ["synthetic", "codex", "neither", "transition"]) test(`shows only available providers: ${scenario}`, () => {
  const result = Bun.spawnSync([process.execPath, "--preload", "@opentui/solid/preload", "tests/fixtures/tui-toggle.tsx", scenario], { stdout: "pipe", stderr: "pipe" })
  expect(result.exitCode, result.stderr.toString()).toBe(0)
}, 15000)
