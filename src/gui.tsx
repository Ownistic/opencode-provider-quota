import { Panel, Plugin, type PanelTab } from "@opencode/plugin/gui"
import { createEffect, createSignal, For, onCleanup, onMount, Show } from "solid-js"
import { decimalPlaces, providerRefreshInterval, showCodexResetDate, validDecimalPlaces, validRefreshSeconds } from "./options"
import { codexPercent, quotaColor, regenerationText, resetText, type Quota } from "./quota"
import type { CodexWindow } from "./codex"
import { SyntheticQuota } from "./rpc"

export default Plugin.define({
  setup(ctx) {
    function QuotaView() {
      const [syntheticInterval, setSyntheticInterval] = createSignal(providerRefreshInterval(ctx.options, "synthetic") / 1000)
      const [codexInterval, setCodexInterval] = createSignal(providerRefreshInterval(ctx.options, "codex") / 1000)
      const [showDate, setShowDate] = createSignal(showCodexResetDate(ctx.options))
      const [digits, setDigits] = createSignal(decimalPlaces(ctx.options))
      const [quota, setQuota] = createSignal<Quota>()
      const [status, setStatus] = createSignal("Loading quota…")
      const [codex, setCodex] = createSignal<CodexWindow[]>()
      const [codexStatus, setCodexStatus] = createSignal("Loading quota…")
      const [now, setNow] = createSignal(Date.now())
      let fetchingSynthetic = false
      let fetchingCodex = false
      let disposed = false
      let settingsVersion = 0

      async function refreshSynthetic() {
        setNow(Date.now())
        if (fetchingSynthetic) return
        fetchingSynthetic = true
        try {
          const result = await ctx.client.rpc(SyntheticQuota).get({}) as { quota?: Quota; status: string }
          if (!disposed) { if (result.quota) setQuota(result.quota); setStatus(result.status) }
        } catch { if (!disposed) setStatus("Quota service unavailable") }
        finally { fetchingSynthetic = false }
      }
      async function refreshCodex() {
        setNow(Date.now())
        if (fetchingCodex) return
        fetchingCodex = true
        try {
          const result = await ctx.client.rpc(SyntheticQuota).codex({}) as { windows?: CodexWindow[]; status: string }
          if (!disposed) { if (result.windows) setCodex(result.windows); setCodexStatus(result.status) }
        } catch { if (!disposed) setCodexStatus("Quota service unavailable") }
        finally { fetchingCodex = false }
      }

      onMount(() => {
        void refreshSynthetic()
        void refreshCodex()
        const clock = setInterval(() => setNow(Date.now()), 1000)
        onCleanup(() => clearInterval(clock))
        const rpc = ctx.client.rpc(SyntheticQuota)
        const unsubscribe = rpc.events.on("settingsChanged", (event) => {
          const value = event.data as { syntheticRefreshSeconds: number; codexRefreshSeconds: number; showCodexResetDate: boolean; decimalPlaces: number }
          settingsVersion++
          if (validRefreshSeconds(value.syntheticRefreshSeconds)) setSyntheticInterval(value.syntheticRefreshSeconds)
          if (validRefreshSeconds(value.codexRefreshSeconds)) setCodexInterval(value.codexRefreshSeconds)
          if (typeof value.showCodexResetDate === "boolean") setShowDate(value.showCodexResetDate)
          if (validDecimalPlaces(value.decimalPlaces)) setDigits(value.decimalPlaces)
        })
        onCleanup(unsubscribe)
        void rpc.settings({}).then((result) => {
          const value = result as { syntheticRefreshSeconds: number; codexRefreshSeconds: number; showCodexResetDate: boolean; decimalPlaces: number }
          if (disposed || settingsVersion !== 0) return
          if (validRefreshSeconds(value.syntheticRefreshSeconds)) setSyntheticInterval(value.syntheticRefreshSeconds)
          if (validRefreshSeconds(value.codexRefreshSeconds)) setCodexInterval(value.codexRefreshSeconds)
          if (typeof value.showCodexResetDate === "boolean") setShowDate(value.showCodexResetDate)
          if (validDecimalPlaces(value.decimalPlaces)) setDigits(value.decimalPlaces)
        }).catch(() => {})
      })
      createEffect(() => {
        const timer = setInterval(() => void refreshSynthetic(), syntheticInterval() * 1000)
        onCleanup(() => clearInterval(timer))
      })
      createEffect(() => {
        const timer = setInterval(() => void refreshCodex(), codexInterval() * 1000)
        onCleanup(() => clearInterval(timer))
      })
      onCleanup(() => {
        disposed = true
      })

      return (
        <section style={{ padding: "16px", color: "inherit", "font-size": "13px" }} aria-label="Provider quotas">
          <h3 style={{ "font-weight": "bold" }}>Synthetic quota</h3>
          <Show when={quota()?.weekly} fallback={<p>{quota() ? "Weekly quota unavailable" : status()}</p>}>
            {(weekly) => (
              <>
                <div style={{ display: "flex", "justify-content": "space-between", gap: "12px", "margin-bottom": "8px" }}>
                  <span>Weekly remaining</span>
                  <span style={{ "font-variant-numeric": "tabular-nums" }}>{weekly().percentRemaining.toFixed(digits())}%</span>
                </div>
                <div role="progressbar" aria-label="Weekly credits remaining" aria-valuemin={0} aria-valuemax={100} aria-valuenow={weekly().percentRemaining} style={{ width: "100%", height: "6px", position: "relative", "border-radius": "3px", overflow: "hidden", background: "color-mix(in srgb, currentColor 18%, transparent)" }}>
                  <div style={{ width: `${weekly().percentRemaining}%`, height: "100%", background: quotaColor(weekly().percentRemaining) }} />
                </div>
                <p style={{ opacity: "0.75", "margin-top": "8px" }}>{regenerationText(weekly(), now())}</p>
              </>
            )}
          </Show>
          <Show when={status() && quota()}><p role="status">Stale: {status()}</p></Show>
          <h3 style={{ "font-weight": "bold" }}>Codex quota</h3>
          <For each={codex()}>{(window) => <div style={{ "margin-bottom": "12px" }}>
            <div style={{ display: "flex", "justify-content": "space-between", gap: "12px", "margin-bottom": "8px" }}>
              <span>{window.label} remaining</span><span>{codexPercent(window.remainingPercent, digits())}%</span>
            </div>
            <div role="progressbar" aria-label={`${window.label} Codex quota remaining`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={window.remainingPercent} style={{ width: "100%", height: "6px", overflow: "hidden", background: "color-mix(in srgb, currentColor 18%, transparent)" }}>
              <div style={{ width: `${window.remainingPercent}%`, height: "100%", background: quotaColor(window.remainingPercent) }} />
            </div>
            <p style={{ opacity: "0.75", "margin-top": "8px" }}>{resetText(window.resetsAt, now(), showDate())}</p>
          </div>}</For>
          <Show when={codexStatus()}><p role="status">{codex() ? `Stale: ${codexStatus()}` : codexStatus()}</p></Show>
        </section>
      )
    }

    const tab: PanelTab = { id: "quota", title: "Provider quotas", pinned: true, fallback: true, tabbable: true }
    ctx.add(Panel, {
      id: "quota",
      region: "side",
      list: () => [tab],
      render: () => <QuotaView />,
    })
  },
})
