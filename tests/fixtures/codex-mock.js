#!/usr/bin/env node
import { createInterface } from "node:readline"

const input = createInterface({ input: process.stdin })
let initialized = false
input.on("line", (line) => {
  const message = JSON.parse(line)
  if (message.id === 1) console.log(JSON.stringify({ id: 1, result: {} }))
  if (message.method === "initialized") initialized = true
  if (message.id === 2 && initialized) console.log(JSON.stringify({ id: 2, result: { rateLimits: {
    primary: { usedPercent: 25, windowDurationMins: 300, resetsAt: 1730947200 },
    secondary: { usedPercent: 75, windowDurationMins: 10080, resetsAt: null },
  } } }))
})
