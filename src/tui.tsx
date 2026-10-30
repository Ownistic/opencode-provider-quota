import { Plugin } from "@opencode/plugin/tui"
import { createSignal, onCleanup, onMount, Show } from "solid-js"
import { regenerationText, type Quota } from "./quota"
import { SyntheticQuota } from "./rpc"

const REFRESH_MS = 60_000

export default Plugin.define({
  id: "synthetic.quota",
  setup(context) {
    function QuotaSidebar() {
      const [quota, setQuota] = createSignal<Quota>()
      const [status, setStatus] = createSignal("Loading quota…")
      const [now, setNow] = createSignal(Date.now())
      let fetching = false
      let timer: ReturnType<typeof setInterval> | undefined
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
        timer = setInterval(() => void refresh(), REFRESH_MS)
      })
      onCleanup(() => {
        disposed = true
        if (timer) clearInterval(timer)
      })

      return (
        <box flexDirection="column" paddingLeft={1} paddingRight={1} marginTop={1}>
          <text fg={context.theme.text.base}>Synthetic quota</text>
          <Show when={quota()}>
            {(value) => (
              <>
                <Show when={value().weekly} fallback={<text fg={context.theme.text.base}>Weekly quota unavailable</text>}>
                  {(weekly) => (
                    <>
                      <text fg={context.theme.text.base}>Weekly remaining: {weekly().percentRemaining.toFixed(2)}%</text>
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
    return context.ui.slot({ append: "sidebar.content", render: () => <QuotaSidebar /> })
  },
})
