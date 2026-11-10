# OpenCode Provider Quota

OpenCode Provider Quota is an OpenCode V2 plugin that shows Synthetic weekly credits and Codex subscription rate-limit windows. It adds a TUI sidebar and a pinned **Provider quotas** tab in the Desktop session side panel. Each provider refreshes independently, every 60 seconds by default, while the view is mounted. The TUI sidebar appears when the terminal is wide enough and `session.sidebar` is not set to `hide`.

The views hide Synthetic when no connection is configured and Codex when its CLI is missing or its active account is not a ChatGPT account. If neither is available, a connection message appears. The plugin keeps checking on each provider's refresh interval, so newly connected providers appear automatically. Other errors remain visible, and previously fetched quotas are marked stale after a failed refresh.

## Install

1. Add the package to the `plugins` array in your project or global `opencode.json`:

   ```json
   {
     "$schema": "https://opencode.ai/config.json",
     "plugins": ["@ownistic/opencode-provider-quota"]
   }
   ```

   Preserve existing settings and plugin entries. For Desktop, use the global `~/.config/opencode/opencode.json` (or `opencode.jsonc`). The server part must be loaded through `opencode.json`; do not configure this as a CLI-only plugin.
2. For Synthetic, connect using OpenCode's normal provider sign-in. The plugin uses the active Synthetic API-key connection from the OpenCode server; no separate environment variable is required.
3. For Codex, install the `codex` CLI on the machine running the OpenCode server and sign in with a ChatGPT account with Codex access (`codex login`). Make it available on the server's PATH, or set `codexCommand` in the plugin options to its absolute executable path. The plugin reads the CLI's own account, which may differ from OpenCode's OpenAI connection. API-key authentication does not provide ChatGPT plan limits.
4. In the TUI, open a session in a sufficiently wide terminal. In Desktop, select **Provider quotas** in the session side panel.

## Quota settings and display

In the TUI, run `/synthetic-quota-settings` or select **Quota settings** in the command palette. Set the Synthetic and Codex refresh intervals independently, choose **Codex reset date** to show or hide the exact date, toggle **Display seconds** for both providers, or set **Decimal places**. Seconds are shown by default. When hidden, countdowns round up to the next minute and the Codex reset date omits seconds. Changes are saved by the OpenCode server and apply immediately to connected quota views on that server, including Desktop. Click the TUI quota display to switch between extended and compact views. Compact view shows each available percentage and labels multiple Codex windows; errors and stale status remain visible. Display mode lasts for the current TUI plugin session. Automatic refresh continues in either mode, and a request already in progress for a provider is not duplicated.

For decimal places, choose a whole number from 0 to 6; the default is 2. Codex percentages reported as whole numbers are shown without decimal places.

For an initial default before a value has been saved, replace the plugin's package entry in `opencode.json` with an object:

```json
{
  "package": "@ownistic/opencode-provider-quota",
  "options": { "syntheticRefreshSeconds": 30, "codexRefreshSeconds": 60, "showCodexResetDate": true, "showSeconds": true, "decimalPlaces": 2, "codexCommand": "/absolute/path/to/codex" }
}
```

Each interval defaults to 60 seconds and accepts values from 10 to 3600 seconds. The date is shown by default. Saved provider values take precedence over configured defaults. An existing saved `refreshSeconds` value is used for each provider until that provider has its own saved interval; the legacy `refreshSeconds` option remains a fallback when no provider-specific default is configured. Each mounted view polls each provider independently; the countdown updates locally every second without making an additional quota request. Desktop uses the settings saved on its own OpenCode server, which may be different from the TUI's server.

`codexCommand` is optional and defaults to `codex`, resolved using the OpenCode server's PATH. Set it to the executable's absolute path when the server cannot find the CLI. It is an executable path, not a shell command with arguments.

The server plugin calls `GET https://api.synthetic.new/v2/quotas` with the active bearer key; Synthetic says these requests do not count against subscription limits. Only the quota result, not the key, is sent to the TUI. Weekly credits and regeneration come directly from `planWeeklyLimit` when present; they are reported as unavailable if the API omits them. A failed refresh marks the last value as stale. Redirects are rejected. If the server is remote, it uses the Synthetic connection on that server.

See [Synthetic quota API](https://dev.synthetic.new/docs/synthetic/quotas) and [OpenCode TUI plugins](https://opencode.ai/v2/docs/build/plugins/cli).

For Codex, the server starts `codex app-server` for each refresh, initializes its JSONL connection, and calls [`account/rateLimits/read`](https://developers.openai.com/codex/app-server/#6-rate-limits-chatgpt). It displays the returned primary and secondary Codex windows, their remaining percentages, and reset times when provided. Missing windows are not inferred. The process is terminated after the response or a 10-second timeout; credentials and CLI output are not sent to the client. A missing CLI, missing ChatGPT login, or failed refresh affects only Codex and marks its last value stale. On a remote server, the CLI and its login must be present on that server.

## Development

Run `bun install`, `bun test`, `bun run typecheck`, and `bun run build`. Rebuild the GUI bundle after Desktop changes. To test a local checkout, add its absolute directory path to `plugins` instead of the package name.

### Publishing

Update the version in `package.json`, then push a matching tag such as `v0.1.1`. The publish workflow runs the tests, type checks, and GUI build before publishing to npm. It uses npm trusted publishing with the GitHub Actions `NPM` environment. You can also run the workflow manually on `main` to publish the version in `package.json`.

## License

OpenCode Provider Quota is licensed under the [GNU Lesser General Public License, version 3 or later](LICENSE) (`LGPL-3.0-or-later`). The LGPL incorporates the terms of the [GNU General Public License, version 3](COPYING.GPL). Dependencies are distributed under their own licenses.
