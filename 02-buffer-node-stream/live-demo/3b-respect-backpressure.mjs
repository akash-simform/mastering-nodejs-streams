// Step 3b — Backpressure RESPECTED: wait for 'drain' when write() says false.
//   node 3b-respect-backpressure.mjs

import { Writable } from 'node:stream'
import { once } from 'node:events'

// The same slow consumer: needs 1 ms to handle each chunk
const slow = new Writable({
  write(chunk, encoding, done) {
    setTimeout(done, 1)
  },
})

let mostWaiting = 0

for (let i = 0; i < 4000; i++) { // 4000 × 64 KB ≈ 250 MB
  const ok = slow.write(Buffer.alloc(65536, 'x'))
  mostWaiting = Math.max(mostWaiting, slow.writableLength)

  if (!ok) await once(slow, 'drain') // ← the only new line: pause until the consumer catches up
}
slow.end()

console.log('waiting in RAM (max):', Math.round(mostWaiting / 1024), 'KB')

// pipeline() and `for await` do this waiting for you.
