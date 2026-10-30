# Synthetic quota for OpenCode

An OpenCode V2 plugin that adds the remaining Synthetic weekly credits and next regeneration to the session sidebar. It refreshes every minute while the sidebar is mounted. The sidebar appears when the terminal is wide enough and `session.sidebar` is not set to `hide`.

## Install locally

1. Install dependencies in this directory with `bun install`.
2. Add this directory's absolute path to the existing `plugins` array in your project or global `opencode.json`:

   ```json
   { "plugins": ["/absolute/path/to/SyntheticOpenCodeTUI"] }
   ```

   Preserve any existing settings and plugin entries. The server part must be loaded through `opencode.json`; do not configure this as a CLI-only plugin.
3. Connect Synthetic using OpenCode's normal provider sign-in, then open a session in a sufficiently wide terminal. The plugin uses the active Synthetic API-key connection from the OpenCode server; no separate environment variable is required.

The server plugin calls `GET https://api.synthetic.new/v2/quotas` with the active bearer key; Synthetic says these requests do not count against subscription limits. Only the quota result, not the key, is sent to the TUI. Weekly credits and regeneration come directly from `planWeeklyLimit` when present; they are reported as unavailable if the API omits them. A failed refresh marks the last value as stale. Redirects are rejected. If the server is remote, it uses the Synthetic connection on that server.

See [Synthetic quota API](https://dev.synthetic.new/docs/synthetic/quotas) and [OpenCode TUI plugins](https://opencode.ai/v2/docs/build/plugins/cli).

## Development

Run `bun test` and `bun run typecheck`.
