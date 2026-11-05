// Step 2a — Read the WHOLE file into memory, then count lines.
//   node 2a-read-whole-file.mjs

import { readFile } from 'node:fs/promises'

const start = Date.now()

const text = await readFile('big.log', 'utf8') // all ~200 MB at once
const lines = text.split('\n').length - 1

console.log('lines  :', lines.toLocaleString())
console.log('time   :', Date.now() - start, 'ms')
console.log('memory :', Math.round(process.memoryUsage().rss / 1024 / 1024), 'MB')
