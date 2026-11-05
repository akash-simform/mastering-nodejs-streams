// Step 5 — The same pipeline, but the filter fails half-way.
//   node 5-pipeline-error.mjs

import { createReadStream, createWriteStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { createGzip } from 'node:zlib'

// Same filter as step 4, but it throws at line 1,500,000
async function* onlyErrors(source) {
  let tail = ''
  let lineNumber = 0
  for await (const chunk of source) {
    const lines = (tail + chunk).split('\n')
    tail = lines.pop()
    lineNumber += lines.length
    if (lineNumber >= 1_500_000) throw new Error('bad record around line 1,500,000')
    const errors = lines.filter((line) => !line.endsWith('status=200'))
    if (errors.length) yield errors.join('\n') + '\n'
  }
}

const input = createReadStream('big.log')
const output = createWriteStream('errors.log.gz')

try {
  await pipeline(input, onlyErrors, createGzip(), output)
} catch (err) {
  // ONE try/catch for every stage, and pipeline() closes all the streams for us
  console.log('❌ caught:', err.message)
  console.log('input file closed :', input.destroyed)
  console.log('output file closed:', output.destroyed)
}
