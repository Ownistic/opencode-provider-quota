# Synthetic quota for OpenCode

An OpenCode V2 plugin that adds the remaining Synthetic weekly credits and next regeneration to the TUI sidebar and a pinned **Synthetic quota** tab in the Desktop session side panel. It refreshes every minute while the view is mounted. The TUI sidebar appears when the terminal is wide enough and `session.sidebar` is not set to `hide`.

## Install locally

1. Install dependencies with `bun install` and build the Desktop bundle with `bun run build`.
2. Add this directory's absolute path to the existing `plugins` array in your project or global `opencode.json`:

   ```json
   { "plugins": ["/absolute/path/to/SyntheticOpenCodeTUI"] }
   ```

   Preserve any existing settings and plugin entries. The server part must be loaded through `opencode.json`; do not configure this as a CLI-only plugin.
3. Connect Synthetic using OpenCode's normal provider sign-in. In the TUI, open a session in a sufficiently wide terminal. In Desktop, open the session side panel and select **Synthetic quota**. The plugin uses the active Synthetic API-key connection from the OpenCode server; no separate environment variable is required.

## Refresh interval and manual refresh

In the TUI, run `/synthetic-quota-settings` or select **Synthetic quota settings** in the command palette. Choose **Refresh interval** to set the value in seconds, or **Decimal places** to choose how many digits appear after the decimal point. Changes are saved by the OpenCode server and apply immediately to connected quota views on that server. Click the quota display in the TUI to request an immediate refresh. A request already in progress is not duplicated.

For decimal places, choose a whole number from 0 to 6; the default is 2.

For an initial default before a value has been saved, replace the plugin's path entry in `opencode.json` with an object:

```json
{
  "package": "/absolute/path/to/SyntheticOpenCodeTUI",
  "options": { "refreshSeconds": 30, "decimalPlaces": 2 }
}
```

The default is 60 seconds. Values from 10 to 3600 seconds are accepted. A saved value takes precedence over the configured initial default. Each mounted view polls independently; the countdown updates locally every second without making an additional quota request. Desktop uses the setting saved on its own OpenCode server, which may be different from the TUI's server.

The server plugin calls `GET https://api.synthetic.new/v2/quotas` with the active bearer key; Synthetic says these requests do not count against subscription limits. Only the quota result, not the key, is sent to the TUI. Weekly credits and regeneration come directly from `planWeeklyLimit` when present; they are reported as unavailable if the API omits them. A failed refresh marks the last value as stale. Redirects are rejected. If the server is remote, it uses the Synthetic connection on that server.

See [Synthetic quota API](https://dev.synthetic.new/docs/synthetic/quotas) and [OpenCode TUI plugins](https://opencode.ai/v2/docs/build/plugins/cli).

## Development

Run `bun test`, `bun run typecheck`, and `bun run build`. Rebuild the GUI bundle after Desktop changes.
