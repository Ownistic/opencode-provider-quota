import { Plugin } from "@opencode/plugin"
import { fetchQuota, QuotaError } from "./quota"
import { SyntheticQuota } from "./rpc"
import { decimalPlaces as defaultDecimalPlaces, refreshInterval, validDecimalPlaces, validRefreshSeconds } from "./options"

export default Plugin.define({
  id: "synthetic.quota.server",
  async setup(context) {
    const stored = await context.storage.get("refreshSeconds")
    let refreshSeconds = validRefreshSeconds(stored) ? stored : refreshInterval(context.options) / 1000
    const storedDigits = await context.storage.get("decimalPlaces")
    let decimalPlaces = validDecimalPlaces(storedDigits) ? storedDigits : defaultDecimalPlaces(context.options)
    const settings = () => ({ refreshSeconds, decimalPlaces })
    const registration = await context.rpc.register(SyntheticQuota, {
      settings: async () => settings(),
      configure: async (input) => {
        const value = (input as { refreshSeconds: number }).refreshSeconds
        if (!validRefreshSeconds(value)) throw new Error("Invalid refresh interval")
        await context.storage.set("refreshSeconds", value)
        refreshSeconds = value
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
