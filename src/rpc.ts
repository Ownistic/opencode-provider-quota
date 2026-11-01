import { Rpc } from "@opencode/plugin/rpc"

const settingsSchema = { type: "object", properties: { refreshSeconds: { type: "number" }, decimalPlaces: { type: "integer" } }, required: ["refreshSeconds", "decimalPlaces"], additionalProperties: false } as const

export const SyntheticQuota = Rpc.define({
  id: "synthetic.quota",
  events: {
    settingsChanged: { schema: settingsSchema },
  },
  methods: {
    settings: {
      input: { type: "object", additionalProperties: false },
      output: settingsSchema,
    },
    configure: {
      input: { type: "object", properties: { refreshSeconds: { type: "number", minimum: 10, maximum: 3600 } }, required: ["refreshSeconds"], additionalProperties: false },
      output: settingsSchema,
    },
    setDecimalPlaces: {
      input: { type: "object", properties: { decimalPlaces: { type: "integer", minimum: 0, maximum: 6 } }, required: ["decimalPlaces"], additionalProperties: false },
      output: settingsSchema,
    },
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
