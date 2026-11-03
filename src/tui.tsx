import { Plugin } from "@opencode/plugin/tui"
import { TextAttributes } from "@opentui/core"
import { createEffect, createSignal, For, onCleanup, onMount, Show } from "solid-js"
import { codexPercent, compactQuotaText, quotaColor, regenerationText, resetText, type Quota } from "./quota"
import type { CodexWindow } from "./codex"
import { SyntheticQuota } from "./rpc"
import { decimalPlaces, providerRefreshInterval, showCodexResetDate, showSeconds, validDecimalPlaces, validRefreshSeconds } from "./options"

export default Plugin.define({
  id: "synthetic.quota",
  setup(context) {
    const [syntheticInterval, setSyntheticInterval] = createSignal(providerRefreshInterval(context.options, "synthetic") / 1000)
    const [codexInterval, setCodexInterval] = createSignal(providerRefreshInterval(context.options, "codex") / 1000)
    const [showDate, setShowDate] = createSignal(showCodexResetDate(context.options))
    const [seconds, setSeconds] = createSignal(showSeconds(context.options))
    const [digits, setDigits] = createSignal(decimalPlaces(context.options))
    const [compact, setCompact] = createSignal(false)
    let settingsVersion = 0
    const rpc = context.client.rpc(SyntheticQuota)
    const unsubscribe = rpc.events.on("settingsChanged", (event) => {
      const value = event.data as { syntheticRefreshSeconds: number; codexRefreshSeconds: number; showCodexResetDate: boolean; showSeconds: boolean; decimalPlaces: number }
      settingsVersion++
      if (validRefreshSeconds(value.syntheticRefreshSeconds)) setSyntheticInterval(value.syntheticRefreshSeconds)
      if (validRefreshSeconds(value.codexRefreshSeconds)) setCodexInterval(value.codexRefreshSeconds)
      if (typeof value.showCodexResetDate === "boolean") setShowDate(value.showCodexResetDate)
      if (typeof value.showSeconds === "boolean") setSeconds(value.showSeconds)
      if (validDecimalPlaces(value.decimalPlaces)) setDigits(value.decimalPlaces)
    })
    void rpc.settings({}).then((result) => {
      const value = result as { syntheticRefreshSeconds: number; codexRefreshSeconds: number; showCodexResetDate: boolean; showSeconds: boolean; decimalPlaces: number }
      if (settingsVersion !== 0) return
      if (validRefreshSeconds(value.syntheticRefreshSeconds)) setSyntheticInterval(value.syntheticRefreshSeconds)
      if (validRefreshSeconds(value.codexRefreshSeconds)) setCodexInterval(value.codexRefreshSeconds)
      if (typeof value.showCodexResetDate === "boolean") setShowDate(value.showCodexResetDate)
      if (typeof value.showSeconds === "boolean") setSeconds(value.showSeconds)
      if (validDecimalPlaces(value.decimalPlaces)) setDigits(value.decimalPlaces)
    }).catch(() => {})
    context.keymap.layer(() => ({
      mode: "global",
      commands: [{
        id: "synthetic.quota.configure",
        title: "Quota settings",
        group: "Quota",
        palette: true,
        slash: { name: "synthetic-quota-settings" },
        run: async () => {
          const choice = await context.ui.dialog.select({
            title: "Quota settings",
            options: [
              { title: "Synthetic refresh interval", description: `${syntheticInterval()} seconds`, value: "synthetic" },
              { title: "Codex refresh interval", description: `${codexInterval()} seconds`, value: "codex" },
              { title: "Codex reset date", description: showDate() ? "Shown" : "Hidden", value: "date" },
              { title: "Display seconds", description: seconds() ? "Shown" : "Hidden", value: "seconds" },
              { title: "Decimal places", description: String(digits()), value: "decimals" },
            ],
          })
          if (!choice) return
          if (choice === "seconds") {
            try {
              const next = !seconds()
              await rpc.setShowSeconds({ show: next })
              setSeconds(next)
              context.ui.toast.show({ message: `Seconds ${next ? "shown" : "hidden"}`, variant: "success" })
            } catch { context.ui.toast.show({ message: "Could not save quota settings", variant: "error" }) }
            return
          }
          if (choice === "date") {
            try {
              const next = !showDate()
              await rpc.setCodexResetDate({ show: next })
              setShowDate(next)
              context.ui.toast.show({ message: `Codex reset date ${next ? "shown" : "hidden"}`, variant: "success" })
            } catch { context.ui.toast.show({ message: "Could not save quota settings", variant: "error" }) }
            return
          }
          const isRefresh = choice === "synthetic" || choice === "codex"
          const answer = await context.ui.dialog.prompt(isRefresh
            ? { title: `${choice === "synthetic" ? "Synthetic" : "Codex"} quota refresh`, description: "Refresh interval in seconds (10–3600)", value: String(choice === "synthetic" ? syntheticInterval() : codexInterval()) }
            : { title: "Quota decimal places", description: "Digits after the decimal point (0–6)", value: String(digits()) })
          if (answer === undefined) return
          const value = answer.trim() ? Number(answer) : NaN
          if (isRefresh ? !validRefreshSeconds(value) : !validDecimalPlaces(value)) {
            context.ui.toast.show({ message: isRefresh ? "Enter a number between 10 and 3600 seconds" : "Enter a whole number between 0 and 6", variant: "error" })
            return
          }
          try {
            if (isRefresh) {
              await rpc.setProviderRefresh({ provider: choice, refreshSeconds: value })
              if (choice === "synthetic") setSyntheticInterval(value)
              else setCodexInterval(value)
            } else {
              await context.client.rpc(SyntheticQuota).setDecimalPlaces({ decimalPlaces: value })
              setDigits(value)
            }
            context.ui.toast.show({ message: isRefresh ? `Quota refresh: ${value}s` : `Quota decimal places: ${value}`, variant: "success" })
          } catch {
            context.ui.toast.show({ message: "Could not save quota settings", variant: "error" })
          }
        },
      }],
    }))
    function QuotaSidebar() {
      const [quota, setQuota] = createSignal<Quota>()
      const [status, setStatus] = createSignal("Loading quota…")
      const [codex, setCodex] = createSignal<CodexWindow[]>()
      const [codexStatus, setCodexStatus] = createSignal("Loading quota…")
      const [syntheticAvailable, setSyntheticAvailable] = createSignal<boolean>()
      const [codexAvailable, setCodexAvailable] = createSignal<boolean>()
      const [now, setNow] = createSignal(Date.now())
      let fetchingSynthetic = false
      let fetchingCodex = false
      let disposed = false
      let dragging = false

      async function refreshSynthetic() {
        setNow(Date.now())
        if (fetchingSynthetic) return
        fetchingSynthetic = true
        try {
          const result = await context.client.rpc(SyntheticQuota).get({}) as { quota?: Quota; status: string; unavailable?: boolean }
          if (!disposed) { setSyntheticAvailable(!result.unavailable); if (result.unavailable) setQuota(undefined); else if (result.quota) setQuota(result.quota); setStatus(result.status) }
        } catch { if (!disposed) { setSyntheticAvailable(true); setStatus("Quota service unavailable") } }
        finally { fetchingSynthetic = false }
      }
      async function refreshCodex() {
        setNow(Date.now())
        if (fetchingCodex) return
        fetchingCodex = true
        try {
          const result = await context.client.rpc(SyntheticQuota).codex({}) as { windows?: CodexWindow[]; status: string; unavailable?: boolean }
          if (!disposed) { setCodexAvailable(!result.unavailable); if (result.unavailable) setCodex(undefined); else if (result.windows) setCodex(result.windows); setCodexStatus(result.status) }
        } catch { if (!disposed) { setCodexAvailable(true); setCodexStatus("Quota service unavailable") } }
        finally { fetchingCodex = false }
      }

      onMount(() => {
        void refreshSynthetic()
        void refreshCodex()
        const clock = setInterval(() => setNow(Date.now()), 1000)
        onCleanup(() => clearInterval(clock))
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
        <box flexDirection="column" paddingLeft={1} paddingRight={1} marginTop={1}
          onMouseDown={() => { dragging = false }}
          onMouseDrag={() => { dragging = true }}
          onMouseUp={(event) => { if (event.button === 0 && !event.isDragging && !dragging) setCompact(!compact()) }}>
          <Show when={syntheticAvailable() === undefined || codexAvailable() === undefined}><text selectable={false} fg={context.theme.text.muted}>Checking providers…</text></Show>
          <Show when={syntheticAvailable() === false && codexAvailable() === false}><text selectable={false} fg={context.theme.text.muted}>No quota providers connected</text></Show>
          <Show when={compact()} fallback={<>
          <Show when={syntheticAvailable()}>
          <text selectable={false} fg={context.theme.text.base} attributes={TextAttributes.BOLD}>Synthetic quota</text>
          <Show when={quota()}>
            {(value) => (
              <>
                <Show when={value().weekly} fallback={<text selectable={false} fg={context.theme.text.base}>Weekly quota unavailable</text>}>
                  {(weekly) => (
                    <>
                      <text selectable={false} fg={context.theme.text.base}>Weekly remaining: {weekly().percentRemaining.toFixed(digits())}%</text>
                      <box width="100%" height={1} backgroundColor={context.theme.text.muted}>
                        <box width={`${weekly().percentRemaining}%`} height={1} backgroundColor={quotaColor(weekly().percentRemaining)} />
                      </box>
                      <text selectable={false} fg={context.theme.text.muted}>{regenerationText(weekly(), now(), seconds())}</text>
                    </>
                  )}
                </Show>
              </>
            )}
          </Show>
          <Show when={status()}><text selectable={false} fg={context.theme.text.base}>{quota() ? `Stale: ${status()}` : status()}</text></Show>
          </Show>
          <Show when={codexAvailable()}>
          <text selectable={false} fg={context.theme.text.base} attributes={TextAttributes.BOLD}>Codex quota</text>
          <For each={codex()}>{(window) => <>
            <text selectable={false} fg={context.theme.text.base}>{window.label} remaining: {codexPercent(window.remainingPercent, digits())}%</text>
            <box width="100%" height={1} backgroundColor={context.theme.text.muted}>
              <box width={`${window.remainingPercent}%`} height={1} backgroundColor={quotaColor(window.remainingPercent)} />
            </box>
            <text selectable={false} fg={context.theme.text.muted}>{resetText(window.resetsAt, now(), showDate(), seconds())}</text>
          </>}</For>
          <Show when={codexStatus()}><text selectable={false} fg={context.theme.text.base}>{codex() ? `Stale: ${codexStatus()}` : codexStatus()}</text></Show>
          </Show>
          </>}>
            <Show when={syntheticAvailable()}>
            <text selectable={false} fg={context.theme.text.base}>{compactQuotaText("Synthetic", quota()?.weekly?.percentRemaining.toFixed(digits()), status())}</text>
            </Show>
            <Show when={codexAvailable()}>
            <Show when={codex()?.length} fallback={<text selectable={false} fg={context.theme.text.base}>{compactQuotaText("Codex", undefined, codexStatus())}</text>}>
              <For each={codex()}>{(window) => <text selectable={false} fg={context.theme.text.base}>{compactQuotaText(codex()!.length > 1 ? `Codex ${window.label}` : "Codex", codexPercent(window.remainingPercent, digits()), codexStatus())}</text>}</For>
            </Show>
            </Show>
          </Show>
        </box>
      )
    }
    const removeSlot = context.ui.slot({ append: "sidebar.content", render: () => <QuotaSidebar /> })
    return () => { unsubscribe(); removeSlot() }
  },
})
