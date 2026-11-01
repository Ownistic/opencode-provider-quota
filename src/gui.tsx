import { Panel, Plugin, type PanelTab } from "@opencode/plugin/gui"
import { createEffect, createSignal, onCleanup, onMount, Show } from "solid-js"
import { decimalPlaces, refreshInterval, validDecimalPlaces, validRefreshSeconds } from "./options"
import { regenerationText, type Quota } from "./quota"
import { SyntheticQuota } from "./rpc"

export default Plugin.define({
  setup(ctx) {
    function QuotaView() {
      const [interval, setIntervalSeconds] = createSignal(refreshInterval(ctx.options) / 1000)
      const [digits, setDigits] = createSignal(decimalPlaces(ctx.options))
      const [quota, setQuota] = createSignal<Quota>()
      const [status, setStatus] = createSignal("Loading quota…")
      const [now, setNow] = createSignal(Date.now())
      let fetching = false
      let disposed = false
      let settingsVersion = 0

      async function refresh() {
        setNow(Date.now())
        if (fetching) return
        fetching = true
        try {
          const result = await ctx.client.rpc(SyntheticQuota).get({}) as { quota?: Quota; status: string }
          if (!disposed) {
            if (result.quota) setQuota(result.quota)
            setStatus(result.status)
          }
        } catch {
          if (!disposed) setStatus("Quota service unavailable")
        } finally {
          fetching = false
        }
      }

      onMount(() => {
        void refresh()
        const clock = setInterval(() => setNow(Date.now()), 1000)
        onCleanup(() => clearInterval(clock))
        const rpc = ctx.client.rpc(SyntheticQuota)
        const unsubscribe = rpc.events.on("settingsChanged", (event) => {
          const value = event.data as { refreshSeconds: number; decimalPlaces: number }
          settingsVersion++
          if (validRefreshSeconds(value.refreshSeconds)) setIntervalSeconds(value.refreshSeconds)
          if (validDecimalPlaces(value.decimalPlaces)) setDigits(value.decimalPlaces)
        })
        onCleanup(unsubscribe)
        void rpc.settings({}).then((result) => {
          const value = result as { refreshSeconds: number; decimalPlaces: number }
          if (disposed || settingsVersion !== 0) return
          if (validRefreshSeconds(value.refreshSeconds)) setIntervalSeconds(value.refreshSeconds)
          if (validDecimalPlaces(value.decimalPlaces)) setDigits(value.decimalPlaces)
        }).catch(() => {})
      })
      createEffect(() => {
        const timer = setInterval(() => void refresh(), interval() * 1000)
        onCleanup(() => clearInterval(timer))
      })
      onCleanup(() => {
        disposed = true
      })

      return (
        <section style={{ padding: "16px", color: "inherit", "font-size": "13px" }} aria-label="Synthetic quota">
          <Show when={quota()?.weekly} fallback={<p>{quota() ? "Weekly quota unavailable" : status()}</p>}>
            {(weekly) => (
              <>
                <div style={{ display: "flex", "justify-content": "space-between", gap: "12px", "margin-bottom": "8px" }}>
                  <span>Weekly remaining</span>
                  <span style={{ "font-variant-numeric": "tabular-nums" }}>{weekly().percentRemaining.toFixed(digits())}%</span>
                </div>
                <div role="progressbar" aria-label="Weekly credits remaining" aria-valuemin={0} aria-valuemax={100} aria-valuenow={weekly().percentRemaining} style={{ width: "100%", height: "6px", position: "relative", "border-radius": "3px", overflow: "hidden", background: "color-mix(in srgb, currentColor 18%, transparent)" }}>
                  <div style={{ width: `${weekly().percentRemaining}%`, height: "100%", background: "currentColor" }} />
                </div>
                <p style={{ opacity: "0.75", "margin-top": "8px" }}>{regenerationText(weekly(), now())}</p>
              </>
            )}
          </Show>
          <Show when={status() && quota()}><p role="status">Stale: {status()}</p></Show>
        </section>
      )
    }

    const tab: PanelTab = { id: "quota", title: "Synthetic quota", pinned: true, fallback: true, tabbable: true }
    ctx.add(Panel, {
      id: "quota",
      region: "side",
      list: () => [tab],
      render: () => <QuotaView />,
    })
  },
})
