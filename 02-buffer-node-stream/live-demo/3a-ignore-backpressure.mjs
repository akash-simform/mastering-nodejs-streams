// Step 3a — Backpressure IGNORED: a fast producer floods a slow consumer.
//   node 3a-ignore-backpressure.mjs

import { Writable } from 'node:stream'

// The slow consumer: needs 1 ms to handle each chunk
const slow = new Writable({
  write(chunk, encoding, done) {
    setTimeout(done, 1)
  },
})

let mostWaiting = 0

for (let i = 0; i < 4000; i++) { // 4000 × 64 KB ≈ 250 MB
  slow.write(Buffer.alloc(65536, 'x')) // write() returns false = "slow down!" … we ignore it
  mostWaiting = Math.max(mostWaiting, slow.writableLength)
}
slow.end()

console.log('waiting in RAM (max):', Math.round(mostWaiting / 1024 / 1024), 'MB')
