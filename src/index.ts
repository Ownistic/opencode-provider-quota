import { Plugin } from "@opencode/plugin"
import { fetchQuota, QuotaError } from "./quota"
import { fetchCodexQuota } from "./codex"
import { SyntheticQuota } from "./rpc"
import { decimalPlaces as defaultDecimalPlaces, providerRefreshInterval, refreshInterval, showCodexResetDate as defaultShowCodexResetDate, showSeconds as defaultShowSeconds, validDecimalPlaces, validRefreshSeconds } from "./options"

export default Plugin.define({
  id: "synthetic.quota.server",
  async setup(context) {
    const stored = await context.storage.get("refreshSeconds")
    let refreshSeconds = validRefreshSeconds(stored) ? stored : refreshInterval(context.options) / 1000
    const storedSynthetic = await context.storage.get("syntheticRefreshSeconds")
    const storedCodex = await context.storage.get("codexRefreshSeconds")
    let syntheticRefreshSeconds = validRefreshSeconds(storedSynthetic) ? storedSynthetic : validRefreshSeconds(stored) ? stored : providerRefreshInterval(context.options, "synthetic") / 1000
    let codexRefreshSeconds = validRefreshSeconds(storedCodex) ? storedCodex : validRefreshSeconds(stored) ? stored : providerRefreshInterval(context.options, "codex") / 1000
    const storedShowDate = await context.storage.get("showCodexResetDate")
    let showCodexResetDate = typeof storedShowDate === "boolean" ? storedShowDate : defaultShowCodexResetDate(context.options)
    const storedShowSeconds = await context.storage.get("showSeconds")
    let showSeconds = typeof storedShowSeconds === "boolean" ? storedShowSeconds : defaultShowSeconds(context.options)
    const storedDigits = await context.storage.get("decimalPlaces")
    let decimalPlaces = validDecimalPlaces(storedDigits) ? storedDigits : defaultDecimalPlaces(context.options)
    const settings = () => ({ refreshSeconds, syntheticRefreshSeconds, codexRefreshSeconds, showCodexResetDate, showSeconds, decimalPlaces })
    const registration = await context.rpc.register(SyntheticQuota, {
      codex: async (_input, call) => {
        try {
          return { windows: await fetchCodexQuota(AbortSignal.any([call.signal, AbortSignal.timeout(10_000)])), status: "" }
        } catch (error) {
          return { status: error instanceof QuotaError ? error.message : "Codex quota request failed" }
        }
      },
      settings: async () => settings(),
      configure: async (input) => {
        const value = (input as { refreshSeconds: number }).refreshSeconds
        if (!validRefreshSeconds(value)) throw new Error("Invalid refresh interval")
        await context.storage.set("refreshSeconds", value)
        await context.storage.set("syntheticRefreshSeconds", value)
        await context.storage.set("codexRefreshSeconds", value)
        refreshSeconds = value
        syntheticRefreshSeconds = value
        codexRefreshSeconds = value
        await registration.events.emit("settingsChanged", settings())
        return settings()
      },
      setProviderRefresh: async (input) => {
        const { provider, refreshSeconds: value } = input as { provider: string; refreshSeconds: number }
        if ((provider !== "synthetic" && provider !== "codex") || !validRefreshSeconds(value)) throw new Error("Invalid provider refresh interval")
        await context.storage.set(provider === "synthetic" ? "syntheticRefreshSeconds" : "codexRefreshSeconds", value)
        if (provider === "synthetic") syntheticRefreshSeconds = value
        else codexRefreshSeconds = value
        await registration.events.emit("settingsChanged", settings())
        return settings()
      },
      setCodexResetDate: async (input) => {
        const value = (input as { show: unknown }).show
        if (typeof value !== "boolean") throw new Error("Invalid Codex reset date setting")
        await context.storage.set("showCodexResetDate", value)
        showCodexResetDate = value
        await registration.events.emit("settingsChanged", settings())
        return settings()
      },
      setShowSeconds: async (input) => {
        const value = (input as { show: unknown }).show
        if (typeof value !== "boolean") throw new Error("Invalid seconds setting")
        await context.storage.set("showSeconds", value)
        showSeconds = value
        await registration.events.emit("settingsChanged", settings())
        return settings()
      },
      setDecimalPlaces: async (input) => {
        const value = (input as { decimalPlaces: number }).decimalPlaces
        if (!validDecimalPlaces(value)) throw new Error("Invalid decimal places")
        await context.storage.set("decimalPlaces", value)
        decimalPlaces = value
        await registration.events.emit("settingsChanged", settings())
        return settings()
      },
      get: async (_input, call) => {
        try {
          const connection = await context.integration.connection.active("synthetic")
          const credential = connection ? await context.integration.connection.resolve(connection) : undefined
          if (!credential) return { status: "Connect Synthetic in OpenCode" }
          if (credential.type !== "key" || !credential.key.trim()) return { status: "Synthetic API key required" }
          const signal = AbortSignal.any([call.signal, AbortSignal.timeout(10_000)])
          return { quota: await fetchQuota(credential.key, signal), status: "" }
        } catch (error) {
          return { status: error instanceof QuotaError ? error.message : "Quota request failed" }
        }
      },
    })
    return () => { void registration.dispose() }
  },
})
