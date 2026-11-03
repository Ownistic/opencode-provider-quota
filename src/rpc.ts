import { Rpc } from "@opencode/plugin/rpc"

const settingsSchema = { type: "object", properties: { refreshSeconds: { type: "number" }, syntheticRefreshSeconds: { type: "number" }, codexRefreshSeconds: { type: "number" }, showCodexResetDate: { type: "boolean" }, showSeconds: { type: "boolean" }, decimalPlaces: { type: "integer" } }, required: ["refreshSeconds", "syntheticRefreshSeconds", "codexRefreshSeconds", "showCodexResetDate", "showSeconds", "decimalPlaces"], additionalProperties: false } as const

export const SyntheticQuota = Rpc.define({
  id: "synthetic.quota",
  events: {
    settingsChanged: { schema: settingsSchema },
  },
  methods: {
    codex: {
      input: { type: "object", additionalProperties: false },
      output: {
        type: "object", properties: {
          status: { type: "string" }, unavailable: { type: "boolean" },
          windows: { type: "array", items: { type: "object", properties: {
            label: { type: "string" }, remainingPercent: { type: "number" },
            resetsAt: { anyOf: [{ type: "string" }, { type: "null" }] },
          }, required: ["label", "remainingPercent", "resetsAt"], additionalProperties: false } },
        }, required: ["status"], additionalProperties: false,
      },
    },
    settings: {
      input: { type: "object", additionalProperties: false },
      output: settingsSchema,
    },
    configure: {
      input: { type: "object", properties: { refreshSeconds: { type: "number", minimum: 10, maximum: 3600 } }, required: ["refreshSeconds"], additionalProperties: false },
      output: settingsSchema,
    },
    setProviderRefresh: {
      input: { type: "object", properties: { provider: { type: "string", enum: ["synthetic", "codex"] }, refreshSeconds: { type: "number", minimum: 10, maximum: 3600 } }, required: ["provider", "refreshSeconds"], additionalProperties: false },
      output: settingsSchema,
    },
    setCodexResetDate: {
      input: { type: "object", properties: { show: { type: "boolean" } }, required: ["show"], additionalProperties: false },
      output: settingsSchema,
    },
    setShowSeconds: {
      input: { type: "object", properties: { show: { type: "boolean" } }, required: ["show"], additionalProperties: false },
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
          status: { type: "string" }, unavailable: { type: "boolean" },
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
