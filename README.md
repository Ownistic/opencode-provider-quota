# Provider quotas for OpenCode

An OpenCode V2 plugin showing Synthetic weekly credits and Codex subscription rate-limit windows in the TUI sidebar and a pinned **Provider quotas** tab in the Desktop session side panel. Each provider reports its own status. It refreshes every minute while the view is mounted. The TUI sidebar appears when the terminal is wide enough and `session.sidebar` is not set to `hide`.

## Install locally

1. Install dependencies with `bun install` and build the Desktop bundle with `bun run build`.
2. Add this directory's absolute path to the existing `plugins` array in your project or global `opencode.json`:

   ```json
   { "plugins": ["/absolute/path/to/SyntheticOpenCodeTUI"] }
   ```

   Preserve any existing settings and plugin entries. The server part must be loaded through `opencode.json`; do not configure this as a CLI-only plugin.
3. For Synthetic, connect using OpenCode's normal provider sign-in. The plugin uses the active Synthetic API-key connection from the OpenCode server; no separate environment variable is required.
4. For Codex, install the `codex` CLI on the machine running the OpenCode server, make it available on that server's PATH, and sign in to the CLI with a ChatGPT account with Codex access (`codex login`). The plugin reads the CLI's own account, which may differ from OpenCode's OpenAI connection. API-key authentication does not provide ChatGPT plan limits. In the TUI, open a session in a sufficiently wide terminal; in Desktop, select **Provider quotas** in the session side panel.

## Refresh interval and manual refresh

In the TUI, run `/synthetic-quota-settings` or select **Quota settings** in the command palette. Set the Synthetic and Codex refresh intervals independently, choose **Codex reset date** to show or hide the exact date (the countdown remains visible), or set **Decimal places** for both providers. Changes are saved by the OpenCode server and apply immediately to connected quota views on that server, including Desktop. Click the quota display in the TUI to request an immediate refresh of both providers. A request already in progress for that provider is not duplicated.

For decimal places, choose a whole number from 0 to 6; the default is 2. Codex percentages reported as whole numbers are shown without decimal places.

For an initial default before a value has been saved, replace the plugin's path entry in `opencode.json` with an object:

```json
{
  "package": "/absolute/path/to/SyntheticOpenCodeTUI",
  "options": { "syntheticRefreshSeconds": 30, "codexRefreshSeconds": 60, "showCodexResetDate": true, "decimalPlaces": 2 }
}
```

Each interval defaults to 60 seconds and accepts values from 10 to 3600 seconds. The date is shown by default. Saved provider values take precedence over configured defaults. An existing saved `refreshSeconds` value is used for each provider until that provider has its own saved interval; the legacy `refreshSeconds` option remains a fallback when no provider-specific default is configured. Each mounted view polls each provider independently; the countdown updates locally every second without making an additional quota request. Desktop uses the settings saved on its own OpenCode server, which may be different from the TUI's server.

The server plugin calls `GET https://api.synthetic.new/v2/quotas` with the active bearer key; Synthetic says these requests do not count against subscription limits. Only the quota result, not the key, is sent to the TUI. Weekly credits and regeneration come directly from `planWeeklyLimit` when present; they are reported as unavailable if the API omits them. A failed refresh marks the last value as stale. Redirects are rejected. If the server is remote, it uses the Synthetic connection on that server.

See [Synthetic quota API](https://dev.synthetic.new/docs/synthetic/quotas) and [OpenCode TUI plugins](https://opencode.ai/v2/docs/build/plugins/cli).

For Codex, the server starts `codex app-server` for each refresh, initializes its JSONL connection, and calls [`account/rateLimits/read`](https://developers.openai.com/codex/app-server/#6-rate-limits-chatgpt). It displays the returned primary and secondary Codex windows, their remaining percentages, and reset times when provided. Missing windows are not inferred. The process is terminated after the response or a 10-second timeout; credentials and CLI output are not sent to the client. A missing CLI, missing ChatGPT login, or failed refresh affects only Codex and marks its last value stale. On a remote server, the CLI and its login must be present on that server.

## Development

Run `bun test`, `bun run typecheck`, and `bun run build`. Rebuild the GUI bundle after Desktop changes.
