import { describe, expect, test } from "bun:test"
import { decimalPlaces, refreshInterval } from "../src/options"

describe("refresh interval", () => {
  test("defaults to one minute", () => {
    for (const refreshSeconds of [undefined, null, 0, 9, 3601, "30", NaN, Infinity]) {
      expect(refreshInterval({ refreshSeconds })).toBe(60_000)
    }
  })
  test("accepts seconds within the supported range", () => {
    expect(refreshInterval({ refreshSeconds: 10 })).toBe(10_000)
    expect(refreshInterval({ refreshSeconds: 30.5 })).toBe(30_500)
    expect(refreshInterval({ refreshSeconds: 3600 })).toBe(3_600_000)
  })
})

test("decimal places default to two and accept whole numbers from zero to six", () => {
  for (const value of [undefined, -1, 7, 1.5, "3", NaN]) expect(decimalPlaces({ decimalPlaces: value })).toBe(2)
  for (const value of [0, 1, 2, 6]) expect(decimalPlaces({ decimalPlaces: value })).toBe(value)
})
