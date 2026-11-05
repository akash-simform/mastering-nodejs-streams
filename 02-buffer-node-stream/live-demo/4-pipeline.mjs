// Step 4 — pipeline(): read → keep errors → gzip → write.
//   node 4-pipeline.mjs

import { createReadStream, createWriteStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { pipeline } from 'node:stream/promises'
import { createGzip } from 'node:zlib'

// Filter step: keep only lines that are NOT status=200.
// A chunk can end in the middle of a line, so we keep that
// unfinished piece ("tail") and glue it onto the next chunk.
async function* onlyErrors(source) {
  let tail = ''
  for await (const chunk of source) {
    const lines = (tail + chunk).split('\n')
    tail = lines.pop()
    const errors = lines.filter((line) => !line.endsWith('status=200'))
    if (errors.length) yield errors.join('\n') + '\n'
  }
}

const start = Date.now()

await pipeline(
  createReadStream('big.log'), // 1. read
  onlyErrors, //                  2. filter
  createGzip(), //                3. compress
  createWriteStream('errors.log.gz'), // 4. write
)

const inMB = Math.round((await stat('big.log')).size / 1024 / 1024)
const outKB = Math.round((await stat('errors.log.gz')).size / 1024)

console.log(`✅ ${inMB} MB in → ${outKB} KB out, in ${Date.now() - start} ms`)
console.log('memory :', Math.round(process.memoryUsage().rss / 1024 / 1024), 'MB')
