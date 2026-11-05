// Setup: create big.log (3 million lines, ~200 MB) for the other demos.
// Run once before the session:  node 0-make-big-log.mjs

import { createWriteStream } from 'node:fs'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

// A generator makes one log line at a time, so we never hold 200 MB in memory
function* logLines() {
  for (let i = 0; i < 3_000_000; i++) {
    const status = i % 50 === 0 ? 500 : i % 20 === 0 ? 404 : 200
    yield `2026-11-05T10:00:00Z INFO user=${i % 997} path=/api/orders/${i} status=${status}\n`
  }
}

// Even creating the file is a stream: lines → file
await pipeline(Readable.from(logLines()), createWriteStream('big.log'))

console.log('big.log is ready')
