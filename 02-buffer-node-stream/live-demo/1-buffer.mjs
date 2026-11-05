// Step 1 — A Buffer is just bytes.
//   node 1-buffer.mjs

const text = 'Hi ₹'
const buf = Buffer.from(text) // text → bytes (UTF-8)

console.log('text       :', text)
console.log('characters :', text.length) // 4
console.log('bytes      :', buf.length) // 6
console.log('raw bytes  :', buf) // <Buffer 48 69 20 e2 82 b9>

// "₹" alone takes 3 bytes.
// Size limits and Content-Length count bytes, not characters.
