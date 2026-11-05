# Buffers & Streams — live demo

Small examples, one idea per file. Needs Node.js 22+, nothing to install.
Run all commands from this folder.

## 0 · Setup

First, create a big test file (200 MB, 3 million log lines):

```
node 0-make-big-log.mjs
```

## 1 · Buffer

A Buffer is raw bytes. Text and bytes are not always the same size: `"Hi ₹"` is 4 characters but 6 bytes.

```
node 1-buffer.mjs
```

## 2 · Read the whole file vs stream it

Reading the whole file loads all of it into memory at once. A stream reads it in small pieces, one at a time.

```
node 2a-read-whole-file.mjs   # ~600 MB of memory
node 2b-stream-file.mjs       # ~80 MB of memory
```

Both give the same answer. The stream just uses much less memory.

## 3 · Backpressure

If you write faster than the other side can handle, data piles up in memory. `write()` returns `false` to say "slow down", and the `'drain'` event says "ready for more".

```
node 3a-ignore-backpressure.mjs    # keeps writing → ~250 MB piles up
node 3b-respect-backpressure.mjs   # waits for 'drain' → only 64 KB
```

The two files differ by just one line. Each takes about 5 seconds.

## 4 · pipeline()

`pipeline()` connects streams like a chain: read the log → keep only the errors → compress → save. It does the waiting for you.

```
node 4-pipeline.mjs   # 200 MB in → ~600 KB out
```

## 5 · Errors in a pipeline

If any step fails, one `try/catch` around `pipeline()` catches it, and every stream is closed for you.

```
node 5-pipeline-error.mjs
```

## Clean up

```
rm big.log errors.log.gz
```
