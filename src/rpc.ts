import { Rpc } from "@opencode/plugin/rpc"

export const SyntheticQuota = Rpc.define({
  id: "synthetic.quota",
  events: {},
  methods: {
    get: {
      input: { type: "object", additionalProperties: false },
      output: {
        type: "object",
        properties: {
          status: { type: "string" },
          quota: {
            type: "object",
            properties: {
              limit: { type: "number" }, requests: { type: "number" },
              renewsAt: { anyOf: [{ type: "string" }, { type: "null" }] },
              remainingPercent: { type: "number" },
              weekly: {
                type: "object",
                properties: {
                  percentRemaining: { type: "number" },
                  nextRegenAt: { anyOf: [{ type: "string" }, { type: "null" }] },
                  nextRegenPercent: { anyOf: [{ type: "number" }, { type: "null" }] },
                },
                required: ["percentRemaining", "nextRegenAt", "nextRegenPercent"],
                additionalProperties: false,
              },
            },
            required: ["limit", "requests", "renewsAt", "remainingPercent"],
            additionalProperties: false,
          },
        },
        required: ["status"],
        additionalProperties: false,
      },
    },
  },
})
