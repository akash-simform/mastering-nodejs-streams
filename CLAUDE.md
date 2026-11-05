# CLAUDE.md

Learning repo for Node.js patterns and streams. Each numbered folder (`01-ecommerce-app`, `02-...`) is a self-contained lesson with its own `package.json`, dependencies and tests.

## Projects

- `01-ecommerce-app/` — Observer pattern: a `Payment` event notifies a `PaymentSubject`, which broadcasts to observers (`Marketing`, `Shipment`, `Invoice`).
  - `src/events/` — things that happen and trigger notifications
  - `src/subjects/` — keep the observer list (`#observers` Set) and call `update(data)` on each
  - `src/observers/` — classes with an `update({ id, userName })` method
  - `src/index.js` — runnable demo wiring everything together

## Commands

Run from inside the lesson folder (e.g. `cd 01-ecommerce-app`):

```bash
npm install
npm start          # runs the demo (node src/index)
npm test           # Jest with coverage (ESM via --experimental-vm-modules)
npx jest -t "PaymentSubject"   # single describe/test by name (prefix NODE_OPTIONS=--experimental-vm-modules)
```

## Conventions

- ES modules (`"type": "module"`): use `import`/`export default`, and always include the `.js` extension in relative imports.
- One class per file, default export, PascalCase class name, lowercase file name (`paymentSubject.js`).
- No semicolons, 2-space indentation.
- Short comments that explain the role of each piece in the pattern (Subject / Observer / Event). This is a learning repo, so the comments are part of the point.
- Observers must handle their own errors; `notify()` is synchronous and doesn't catch anything.

## Testing

- Tests live in `test/*.test.js` and import Jest helpers from `@jest/globals`.
- `console.log` is mocked in `beforeEach`; assert on log output with `expect(console.log).toHaveBeenCalledWith(...)`.
- `jest.config.mjs` sets a 100% coverage threshold. Coverage only counts files that tests import, so new source files need tests or the gap goes unnoticed.
- Add or update tests with every source change, and run `npm test` before considering work done.

## Commits

- Commits are authored by Akash Chauhan, using the git config identity (`user.name` / `user.email`). Don't override the author or committer.
- Don't add a `Co-Authored-By: Claude` trailer or any other AI attribution line to commit messages or PR descriptions.
- Only commit when asked. Run `npm test` in the affected lesson folder first and don't commit if it fails.
- Message format: short imperative subject (≤ 72 chars), prefixed with the lesson when relevant, e.g. `01-ecommerce-app: add Invoice observer tests`. Add a body only when the "why" isn't obvious.
- Stage specific files; never commit `node_modules/`, `coverage/` or `.env` files.

## Gotchas

- `coverage/` is generated output and is gitignored; don't edit it.
- `01-ecommerce-app/` contains its own nested `.git` repo, separate from the root repo.
