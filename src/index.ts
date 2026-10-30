import { Plugin } from "@opencode/plugin"
import { fetchQuota, QuotaError } from "./quota"
import { SyntheticQuota } from "./rpc"

export default Plugin.define({
  id: "synthetic.quota.server",
  async setup(context) {
    const registration = await context.rpc.register(SyntheticQuota, {
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
