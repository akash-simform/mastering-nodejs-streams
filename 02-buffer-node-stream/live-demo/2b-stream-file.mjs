// Step 2b — STREAM the file: handle one small piece at a time.
//   node 2b-stream-file.mjs

import { createReadStream } from 'node:fs'

const start = Date.now()
let lines = 0

// Each chunk is a Buffer of 64 KB. We only ever hold one in memory.
for await (const chunk of createReadStream('big.log')) {
  for (const byte of chunk) {
    if (byte === 10) lines++ // 10 is the byte for '\n'
  }
}

console.log('lines  :', lines.toLocaleString())
console.log('time   :', Date.now() - start, 'ms')
console.log('memory :', Math.round(process.memoryUsage().rss / 1024 / 1024), 'MB')
