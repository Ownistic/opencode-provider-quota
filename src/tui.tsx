import { Plugin } from "@opencode/plugin/tui"
import { createEffect, createSignal, onCleanup, onMount, Show } from "solid-js"
import { regenerationText, type Quota } from "./quota"
import { SyntheticQuota } from "./rpc"
import { decimalPlaces, refreshInterval, validDecimalPlaces, validRefreshSeconds } from "./options"

export default Plugin.define({
  id: "synthetic.quota",
  setup(context) {
    const [interval, setIntervalSeconds] = createSignal(refreshInterval(context.options) / 1000)
    const [digits, setDigits] = createSignal(decimalPlaces(context.options))
    let settingsVersion = 0
    const rpc = context.client.rpc(SyntheticQuota)
    const unsubscribe = rpc.events.on("settingsChanged", (event) => {
      const value = event.data as { refreshSeconds: number; decimalPlaces: number }
      settingsVersion++
      if (validRefreshSeconds(value.refreshSeconds)) setIntervalSeconds(value.refreshSeconds)
      if (validDecimalPlaces(value.decimalPlaces)) setDigits(value.decimalPlaces)
    })
    void rpc.settings({}).then((result) => {
      const value = result as { refreshSeconds: number; decimalPlaces: number }
      if (settingsVersion !== 0) return
      if (validRefreshSeconds(value.refreshSeconds)) setIntervalSeconds(value.refreshSeconds)
      if (validDecimalPlaces(value.decimalPlaces)) setDigits(value.decimalPlaces)
    }).catch(() => {})
    context.keymap.layer(() => ({
      mode: "global",
      commands: [{
        id: "synthetic.quota.configure",
        title: "Synthetic quota settings",
        group: "Synthetic quota",
        palette: true,
        slash: { name: "synthetic-quota-settings" },
        run: async () => {
          const choice = await context.ui.dialog.select({
            title: "Synthetic quota settings",
            options: [
              { title: "Refresh interval", description: `${interval()} seconds`, value: "refresh" },
              { title: "Decimal places", description: String(digits()), value: "decimals" },
            ],
          })
          if (!choice) return
          const isRefresh = choice === "refresh"
          const answer = await context.ui.dialog.prompt(isRefresh
            ? { title: "Synthetic quota refresh", description: "Refresh interval in seconds (10–3600)", value: String(interval()) }
            : { title: "Synthetic quota decimal places", description: "Digits after the decimal point (0–6)", value: String(digits()) })
          if (answer === undefined) return
          const value = answer.trim() ? Number(answer) : NaN
          if (isRefresh ? !validRefreshSeconds(value) : !validDecimalPlaces(value)) {
            context.ui.toast.show({ message: isRefresh ? "Enter a number between 10 and 3600 seconds" : "Enter a whole number between 0 and 6", variant: "error" })
            return
          }
          try {
            if (isRefresh) {
              await context.client.rpc(SyntheticQuota).configure({ refreshSeconds: value })
              setIntervalSeconds(value)
            } else {
              await context.client.rpc(SyntheticQuota).setDecimalPlaces({ decimalPlaces: value })
              setDigits(value)
            }
            context.ui.toast.show({ message: isRefresh ? `Synthetic quota refresh: ${value}s` : `Synthetic quota decimal places: ${value}`, variant: "success" })
          } catch {
            context.ui.toast.show({ message: "Could not save Synthetic quota settings", variant: "error" })
          }
        },
      }],
    }))
    function QuotaSidebar() {
      const [quota, setQuota] = createSignal<Quota>()
      const [status, setStatus] = createSignal("Loading quota…")
      const [now, setNow] = createSignal(Date.now())
      let fetching = false
      let disposed = false

      async function refresh() {
        setNow(Date.now())
        if (fetching) return
        fetching = true
        try {
          const result = await context.client.rpc(SyntheticQuota).get({}) as { quota?: Quota; status: string }
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
      })
      createEffect(() => {
        const timer = setInterval(() => void refresh(), interval() * 1000)
        onCleanup(() => clearInterval(timer))
      })
      onCleanup(() => {
        disposed = true
      })

      return (
        <box flexDirection="column" paddingLeft={1} paddingRight={1} marginTop={1} onMouseUp={(event) => { if (event.button === 0 && !event.isDragging) void refresh() }}>
          <text fg={context.theme.text.base}>Synthetic quota</text>
          <Show when={quota()}>
            {(value) => (
              <>
                <Show when={value().weekly} fallback={<text fg={context.theme.text.base}>Weekly quota unavailable</text>}>
                  {(weekly) => (
                    <>
                      <text fg={context.theme.text.base}>Weekly remaining: {weekly().percentRemaining.toFixed(digits())}%</text>
                      <box width="100%" height={1} backgroundColor={context.theme.text.muted}>
                        <box width={`${weekly().percentRemaining}%`} height={1} backgroundColor={context.theme.text.base} />
                      </box>
                      <text fg={context.theme.text.base}>{regenerationText(weekly(), now())}</text>
                    </>
                  )}
                </Show>
              </>
            )}
          </Show>
          <Show when={status()}><text fg={context.theme.text.base}>{quota() ? `Stale: ${status()}` : status()}</text></Show>
        </box>
      )
    }
    const removeSlot = context.ui.slot({ append: "sidebar.content", render: () => <QuotaSidebar /> })
    return () => { unsubscribe(); removeSlot() }
  },
})
