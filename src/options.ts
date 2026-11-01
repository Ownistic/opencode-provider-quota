export const DEFAULT_REFRESH_SECONDS = 60
export const MIN_REFRESH_SECONDS = 10
export const MAX_REFRESH_SECONDS = 3600
export const DEFAULT_DECIMAL_PLACES = 2
export const MAX_DECIMAL_PLACES = 6

export function validDecimalPlaces(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= MAX_DECIMAL_PLACES
}

export function decimalPlaces(options: { readonly decimalPlaces?: unknown }): number {
  return validDecimalPlaces(options.decimalPlaces) ? options.decimalPlaces : DEFAULT_DECIMAL_PLACES
}

export function validRefreshSeconds(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= MIN_REFRESH_SECONDS && value <= MAX_REFRESH_SECONDS
}

export function refreshInterval(options: { readonly refreshSeconds?: unknown }): number {
  const value = options.refreshSeconds
  return validRefreshSeconds(value)
    ? Math.round(value * 1000)
    : DEFAULT_REFRESH_SECONDS * 1000
}

export function providerRefreshInterval(options: { readonly refreshSeconds?: unknown; readonly syntheticRefreshSeconds?: unknown; readonly codexRefreshSeconds?: unknown }, provider: "synthetic" | "codex"): number {
  const value = provider === "synthetic" ? options.syntheticRefreshSeconds : options.codexRefreshSeconds
  return validRefreshSeconds(value) ? Math.round(value * 1000) : refreshInterval(options)
}

export function showCodexResetDate(options: { readonly showCodexResetDate?: unknown }): boolean {
  return typeof options.showCodexResetDate === "boolean" ? options.showCodexResetDate : true
}
