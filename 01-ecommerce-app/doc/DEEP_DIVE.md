# Events & Observer Pattern: Deep Dive

**Series:** Node.js Streams & Backend Engineering
**Example project:** `01-ecommerce-app` (Payments in an online shop)

This is the take-home guide for the session. It goes from "what is an event" all the way to how real payment systems use events in production.

Every code example and output here was **run and checked on Node.js v22.16.0**, unless it is marked as a *sketch*.

### How to read this guide

| Level | Topic | Who should read it |
|---|---|---|
| 1 | The idea | Everyone |
| 2 | Our project, file by file | Everyone |
| 3 | How `notify()` really runs, and how it breaks | Everyone who writes code |
| 4 | Node.js `EventEmitter` in depth | Node.js developers |
| 5 | Production patterns inside one service | Backend developers |
| 6 | Events across services: queues, brokers, outbox | Backend / senior developers |
| 7 | Real world: payment webhooks (Razorpay, Stripe) | Anyone touching payments |
| 8 | Decision guide, pitfalls, exercises, Q&A | Everyone |

Juniors can stop after Level 3 and still use this in their code.

---

## Level 1: The idea

### Two sentences
1. **An event** is something that happened. *A customer paid. A user signed up. A file was uploaded.*
2. **The Observer pattern** announces the event once, and every observer that is listening reacts in its own way.

### The 3 roles

| Role | Job | In our project |
|---|---|---|
| **Event producer** | Does the work, then announces "this happened" | `Payment` |
| **Subject** | Keeps the list of observers, and delivers the event to them | `PaymentSubject` |
| **Observer** | Listens, and reacts to the event | `Marketing`, `Shipment` |

### The 4 words (and their Node.js names)

| Observer pattern | Meaning | Node.js `EventEmitter` |
|---|---|---|
| `subscribe(observer)` | start listening | `emitter.on(name, fn)` |
| `unsubscribe(observer)` | stop listening | `emitter.off(name, fn)` |
| `notify(data)` | announce the event | `emitter.emit(name, data)` |
| `observer.update(data)` | react to the event | the listener function `fn` |

### Why we use it: decoupling
Without the pattern, the producer calls every reaction itself:

```js
class Payment {
  creditCard(user) {
    marketing.sendEmail(user)
    shipment.packOrder(user)
    invoice.create(user)        // every new reaction = edit Payment again
  }
}
```

With the pattern, the producer only says "a payment happened". Who reacts is decided somewhere else.

This gives us:
- **Open/Closed principle.** New behaviour is added with new code (a new observer). Old code (`Payment`) is not modified.
- **Single responsibility.** Payment takes payments. Marketing does marketing. Each file has one reason to change.
- **Testability.** Each part can be tested alone, with a fake observer or a fake subject.
- **Runtime flexibility.** Features can be switched on or off by subscribing or unsubscribing.
- **Team independence.** Each team owns its observer file.

### Analogy
A **WhatsApp group**. You post once. The group delivers the message. Every member reads it. Members can join and leave. You never message each member yourself.

---

## Level 2: Our project, file by file

```
src/
├── events/payment.js            Event producer
├── subjects/paymentSubject.js   Subject
├── observers/marketing.js       Observer
├── observers/shipment.js        Observer
└── index.js                     Wiring (composition root)
test/index.test.js               4 tests, 100% coverage
```

### `src/subjects/paymentSubject.js`: the subject
```js
export default class PaymentSubject {
  #observers = new Set()

  notify(data) {
    this.#observers.forEach(observer => observer.update(data))
  }

  unsubscribe(observable) {
    this.#observers.delete(observable)
  }

  subscribe(observable) {
    this.#observers.add(observable)
  }
}
```

What to notice:
- **`#observers` is a private class field.** Code outside the class cannot read or replace the list (`subject.#observers` is a syntax error). The only way in is `subscribe` and `unsubscribe`.
- **It is a `Set`, not an array.**
  - Subscribing the same observer twice has no effect, so it is never notified twice. *(Verified: a duplicate `subscribe(shipment)` still prints one line.)*
  - `delete` is one call. An array would need `indexOf` + `splice`.
  - A `Set` keeps insertion order, so observers are notified in the order they subscribed.
- **`notify` is synchronous.** It does not `await` anything. This matters a lot in Level 3.
- **Naming.** The parameter is called `observable`, but it is really an *observer*. This is just a naming slip in the course code.

### `src/observers/marketing.js` and `shipment.js`: the observers
```js
export default class Shipment {
  update({ id, userName }) {
    console.log(`[${id}]: [shipment] will pack the user's order to [${userName}]`)
  }
}
```

- **The only contract is "has an `update` method".** There is no base class and no `implements`. This is duck typing.
- That is why the tests can use `{ update: jest.fn() }` as an observer.
- `marketing.js` has a comment that is the most important lesson in the project: *the function `update` is responsible for handling its own errors.* Level 3 shows why.

### `src/events/payment.js`: the event producer
```js
export default class Payment {
  constructor(paymentSubject) {
    this.paymentSubject = paymentSubject
  }

  creditCard({ id, userName, age }) {
    console.log(`\na payment ocurred from ${userName}`)
    this.paymentSubject.notify({ id, userName })
  }
}
```

- **Dependency injection.** The subject is passed in through the constructor. Payment does not create it, so a test can pass a fake.
- **The producer decides the event data.** `age` comes in but is not sent. Observers only get `{ id, userName }`. Keep events small, and leave out sensitive data.
- **Decoupling.** The words `Marketing` and `Shipment` do not appear in this file.

### `src/index.js`: the wiring
```js
const subject = new PaymentSubject()

const marketing = new Marketing()
subject.subscribe(marketing)

const shipment = new Shipment()
subject.subscribe(shipment)

const payment = new Payment(subject)
payment.creditCard({ id: 1, userName: 'erick', age: 27 })

subject.unsubscribe(marketing)

payment.creditCard({ id: 2, userName: 'wendel', age:30 })
```

This is the **composition root**: the one place that knows every part and connects them.

Output of `npm start`:
```
a payment ocurred from erick
[1]: [marketing] will send an welcom email to [erick]
[1]: [shipment] will pack the user's order to [erick]

a payment ocurred from wendel
[2]: [shipment] will pack the user's order to [wendel]
```

### `test/index.test.js`: how the tests prove it

| Test | What it proves | Technique |
|---|---|---|
| `#PaymentSubject notify observers` | A subscribed observer gets exactly the data passed to `notify` | Fake observer `{ update: jest.fn() }` |
| `#PaymentSubject should not notify unsubscribed observers` | After `unsubscribe`, `update` is never called | `expect(...).not.toHaveBeenCalled()` |
| `#Payment should notify subject after a credit card transaction` | `creditCard` calls `notify({ id, userName })` | `jest.spyOn(subject, subject.notify.name)`. `.name` gives `'notify'`, so a rename can't silently break the test |
| `#All should notify subscribers after a credit card payment` | One payment reaches both real observers | Spies on real `Shipment` and `Marketing` |

`jest.config.mjs` sets a **100% coverage threshold** (branches, functions, lines, statements). The build fails if coverage drops.

**A missing test:** nothing tests what happens when an observer throws. That is a good team exercise (see Level 8).

### Adding a new observer (verified)
1. Create `src/observers/invoice.js`:
   ```js
   export default class Invoice {
     update({ id, userName }) {
       console.log(`[${id}]: [invoice] will create the bill for [${userName}]`)
     }
   }
   ```
2. In `src/index.js`, add an import and two lines:
   ```js
   import Invoice from "./observers/invoice.js"
   const invoice = new Invoice()
   subject.subscribe(invoice)
   ```
3. Result:
   ```
   [1]: [invoice] will create the bill for [erick]
   [2]: [invoice] will create the bill for [wendel]
   ```

`payment.js` has **0 lines changed**.

---

## Level 3: How `notify()` really runs, and how it breaks

### It is one synchronous call chain
```
index.js
 └─ payment.creditCard()
     └─ subject.notify(data)
         ├─ marketing.update(data)   ← runs fully
         └─ shipment.update(data)    ← then this runs
     ← notify returns
 ← creditCard returns
```

- Everything runs on **one thread, in order, right now**. Nothing is queued.
- `creditCard()` does not return until the **last** observer finishes.
- A **slow observer makes the payment slow.**

### Failure 1: one observer throws, so later observers never run (verified)

If `Marketing.update` throws (for example, the email server is down):
```
a payment ocurred from a
CAUGHT IN PAYMENT: email server down     ← Shipment's line never printed
```

`forEach` stops at the first throw. Shipment is skipped, and the error goes back up into `Payment.creditCard()`.

**A broken email server stops orders from shipping.**

### Failure 2: an async observer rejects, and the process crashes (verified)

If `update` is `async` and its promise rejects:
```
[2]: [shipment] will pack the user's order to [b]
payment returned normally
Error: async fail
    at Object.update ...
    at Set.forEach (<anonymous>)
Node.js v22.16.0          → exit code 1
```

`notify` never awaits the promise, so nobody handles the rejection. Since Node.js 15, an **unhandled promise rejection crashes the process by default**.

### Not a failure: duplicate subscribe (verified)
Because `#observers` is a `Set`, `subscribe(shipment)` twice still notifies Shipment **once**.

### The fix: isolate each observer
Option A, the rule from the course: **each observer catches its own errors.**
```js
update({ id, userName }) {
  try {
    sendEmail(userName)
  } catch (error) {
    logger.error(error)          // log it, maybe retry later
  }
}
```
*(Verified: with try/catch in Marketing, Shipment still runs.)*

Option B: make the **subject** defensive, so one bad observer can't hurt the others, sync or async (*sketch*):
```js
notify(data) {
  for (const observer of this.#observers) {
    try {
      Promise.resolve(observer.update(data))
        .catch(error => logger.error({ error, observer: observer.constructor.name }))
    } catch (error) {
      logger.error({ error, observer: observer.constructor.name })
    }
  }
}
```

In production, use **both**.

### Memory leaks
The subject holds a **strong reference** to every observer. If short-lived objects (per request, per WebSocket connection, per React component) subscribe and never unsubscribe, they are never garbage-collected.

**Rule: every `subscribe` needs a matching `unsubscribe` when the observer's life ends.**

React's `useEffect` cleanup function exists for exactly this:
```js
useEffect(() => {
  const unsubscribe = store.subscribe(render)
  return unsubscribe                      // runs when the component goes away
}, [])
```

---

## Level 4: Node.js `EventEmitter` in depth

In real Node.js code you rarely write a subject class yourself. **Node.js already has one: `EventEmitter`** (from `node:events`).

The big difference from our project is that **events have names**. One emitter can carry many event types.

```js
import { EventEmitter } from 'node:events'

const payments = new EventEmitter()                      // the subject

payments.on('paid', data => sendEmail(data))             // observer 1
payments.on('paid', data => packOrder(data))             // observer 2

payments.emit('paid', { id: 1, userName: 'erick' })      // the event
```

### Everything important in Node.js is an EventEmitter (verified)
```
Readable stream instanceof EventEmitter → true
http.Server     instanceof EventEmitter → true
process         instanceof EventEmitter → true
```

This is why this lesson is in a **Streams** course:
- `stream.on('data')`, `stream.on('end')`, `stream.on('error')`
- `server.on('request')`
- `process.on('SIGTERM')`

These are all the Observer pattern.

### 11 behaviours you should know (all verified on Node v22.16.0)

**1. `emit` is synchronous, and listeners run in the order they were added.**
```js
e.on('paid', () => log('listener A'))
e.on('paid', () => log('listener B'))
log('before emit'); e.emit('paid'); log('after emit')
```
```
before emit
listener A
listener B
after emit
```
This is the same as our `PaymentSubject.notify`.

**2. `emit` returns `true` if anyone was listening, `false` if nobody was.**
```
emit returned true
emit with no listeners returns false
```
This is useful for logging "event fired but nobody handled it".

**3. `once()` listens only one time.**
```js
e.once('x', () => log('once fired'))
e.emit('x'); e.emit('x')
```
```
once fired              ← only once
listenerCount after: 0  ← removed automatically
```
Use it for things like "send a coupon on the user's first purchase" or "server is ready".

**4. The `'error'` event is special. If nobody listens, `emit('error')` throws.**
```js
new EventEmitter().emit('error', new Error('boom'))   // THROWS: boom
```
Uncaught, this crashes the process. **Always add an `'error'` listener** on emitters you create, and on every stream.

**5. A listener that throws stops the listeners after it, same as our project.**
```
emit threw: email down (shipment did NOT run)
```

**6. `captureRejections: true` sends async listener failures to the `'error'` event.**
```js
const e = new EventEmitter({ captureRejections: true })
e.on('p', async () => { throw new Error('async email down') })
e.on('error', err => log('routed to error event:', err.message))
e.emit('p')
```
```
routed to error event: async email down
```
Without this option, the rejection is unhandled and can crash the process (Failure 2 in Level 3).

**7. The memory-leak warning: more than 10 listeners on one event.**
```
MaxListenersExceededWarning: Possible EventEmitter memory leak detected.
11 leak listeners added to [EventEmitter]. MaxListeners is 10.
```
- The default is `EventEmitter.defaultMaxListeners = 10`.
- The warning usually means a missing `off()`, such as subscribing on every request.
- Only raise the limit with `setMaxListeners(n)` when you really need many listeners.

**8. `await once(emitter, name)` turns an event into a promise.**
```js
import { once } from 'node:events'
const [value] = await once(server, 'ready')     // got { port: 3000 }
```

**9. `for await (... of on(emitter, name))` turns events into an async loop.**
```js
import { on } from 'node:events'
const ac = new AbortController()
for await (const [order] of on(orders, 'order', { signal: ac.signal })) {
  handle(order)                 // order 1, order 2 ...
}
// ac.abort() stops the loop with an AbortError
```

**10. `off()` removes a listener.** You must pass the **same function reference**:
```js
const handler = data => {...}
e.on('z', handler)
e.off('z', handler)    // works
e.off('z', data => {...})   // does NOT work: a different function
```

**11. Stream events arrive in a fixed order.**
```
data a
data b
end
close
```

### Other `EventEmitter` methods worth knowing
- `prependListener(name, fn)`: add a listener at the **front** of the list.
- `removeAllListeners(name)`: clear all listeners. Use carefully.
- `listenerCount(name)`: how many are listening. Useful in tests and leak checks.
- `eventNames()`: which events have listeners.

---

## Level 5: Production patterns inside one service

### Pattern 5.1: A safe event bus (verified)
This is a small wrapper around `EventEmitter` that fixes every problem from Level 3:
- One failing handler cannot stop the others.
- Async failures are caught and logged, not crashed on.
- `subscribe` returns an unsubscribe function, so it is easy to clean up.
- Events are frozen, so one observer cannot change the data another observer sees.
- Each event is stamped with `occurredAt`.

```js
import { EventEmitter } from 'node:events'

export class EventBus {
  #emitter = new EventEmitter()
  #logger

  constructor(logger = console) {
    this.#logger = logger
  }

  subscribe(eventName, handler) {
    const safeHandler = async payload => {
      try {
        await handler(payload)
      } catch (error) {
        this.#logger.error(`[event-bus] ${handler.name} failed on ${eventName}: ${error.message}`)
      }
    }
    this.#emitter.on(eventName, safeHandler)
    return () => this.#emitter.off(eventName, safeHandler)
  }

  publish(eventName, payload) {
    const event = Object.freeze({ ...payload, occurredAt: new Date().toISOString() })
    return this.#emitter.emit(eventName, event)
  }
}
```

Using it with our payment example:
```js
const bus = new EventBus()

async function sendWelcomeEmail({ userName }) { throw new Error('SMTP timeout') }
async function packOrder({ id, userName }) { console.log(`[${id}] packing order for ${userName}`) }
function trackAnalytics({ id }) { console.log(`[${id}] analytics recorded`) }

const stopEmail = bus.subscribe('payment.captured', sendWelcomeEmail)
bus.subscribe('payment.captured', packOrder)
bus.subscribe('payment.captured', trackAnalytics)

bus.publish('payment.captured', { id: 1, userName: 'erick' })
stopEmail()
bus.publish('payment.captured', { id: 2, userName: 'wendel' })
```

Real output:
```
[1] packing order for erick
[1] analytics recorded
[event-bus] sendWelcomeEmail failed on payment.captured: SMTP timeout
[2] packing order for wendel
[2] analytics recorded
```

The email failed, but packing and analytics **still ran**, and the process did not crash.

**Event naming tip:** use `noun.verb-in-past-tense`, such as `payment.captured`, `order.paid` or `user.signed_up`. Payment providers like Razorpay name their events this way (see Level 7).

### Pattern 5.2: NestJS `@nestjs/event-emitter`
NestJS's official events package is described in its docs as "a simple observer implementation". *(Sketch based on the [NestJS events docs](https://docs.nestjs.com/techniques/events). Check the docs for your version.)*

```ts
// app.module.ts
@Module({ imports: [EventEmitterModule.forRoot()] })
export class AppModule {}

// payments.service.ts   (event producer)
@Injectable()
export class PaymentsService {
  constructor(private eventEmitter: EventEmitter2) {}

  async capture(payment: Payment) {
    // ...save the payment...
    this.eventEmitter.emit('payment.captured', new PaymentCapturedEvent(payment.id, payment.userName))
  }
}

// marketing.listener.ts   (observer)
@Injectable()
export class MarketingListener {
  @OnEvent('payment.captured', { async: true })
  async handlePaymentCaptured(event: PaymentCapturedEvent) {
    // send welcome email
  }
}
```

- `@OnEvent` is the NestJS version of `subscribe` plus `update`.
- `{ async: true }` makes the listener run without blocking the emitter.
- Wildcards such as `@OnEvent('**')` are supported through EventEmitter2.

### Pattern 5.3: The observer only enqueues, a worker does the heavy work
In-process events are lost if the process crashes in the middle. Long work (emails, PDFs, external APIs) should not run inside `emit`.

Common practice: the observer only **puts a job on a queue** (for example BullMQ on Redis), and a worker does the job with retries. *(Sketch)*
```js
bus.subscribe('payment.captured', async event => {
  await emailQueue.add('send-welcome-email', { userName: event.userName })   // fast, durable
})
```

### Pattern 5.4: Domain events
In larger codebases (DDD style), business objects record events such as `OrderPaid` or `PaymentRefunded`. These are published after the database transaction commits. It is the same Observer idea, with event names that use business language.

---

## Level 6: Events across services

### Why the in-memory version is not enough
| Problem | In-memory `EventEmitter` / `PaymentSubject` |
|---|---|
| Process crashes after payment, before notify | Event is **lost** |
| You run 3 server instances | Each instance only notifies **its own** observers |
| Observer service is down for 5 minutes | It **misses** every event in that time |
| Need to replay old events | Not possible |

For events that **must not be lost** (money, orders, stock), use a **message broker**. The idea is the same: the broker becomes the subject, and other services become the observers.

### Common brokers
| Tool | Model | Good for | Note |
|---|---|---|---|
| **Kafka** | Durable log, consumer groups | High volume, replay, event streaming | Events are kept and can be replayed |
| **RabbitMQ** | Queues, exchanges, routing | Task distribution, routing by type | Mature, flexible routing |
| **AWS SNS + SQS** | Topic (SNS) fans out to queues (SQS) | Managed AWS setups | Classic fan-out: one event, many queues |
| **Redis Pub/Sub** | Fire and forget | Live notifications, cache invalidation | **No persistence**: a subscriber that is offline misses messages |
| **Redis Streams** | Durable stream, consumer groups | Lighter alternative to Kafka | Messages are stored and acknowledged |

### The dual-write problem and the transactional outbox
The classic bug:
```js
await db.query('UPDATE orders SET status = $1 WHERE id = $2', ['paid', orderId])
await broker.publish('order.paid', payload)      // ← crash here = DB says paid, nobody was told
```

You can't make a database write and a broker publish atomic without distributed transactions, which are slow and complex.

**The transactional outbox** ([microservices.io](https://microservices.io/patterns/data/transactional-outbox.html)) solves it:
1. In the **same database transaction**, update the order **and** insert a row into an `outbox` table.
2. A separate **relay** reads new outbox rows and publishes them to the broker. It does this by polling, or with CDC tools such as Debezium.
3. It marks the rows as published.

*(Sketch)*
```js
await db.transaction(async tx => {
  await tx.query('UPDATE orders SET status = $1 WHERE id = $2', ['paid', orderId])
  await tx.query(
    'INSERT INTO outbox (id, event_name, payload) VALUES ($1, $2, $3)',
    [randomUUID(), 'order.paid', JSON.stringify(payload)]
  )
})
// relay worker: SELECT unpublished rows → publish to broker → mark as published
```

Things to know:
- This gives **at-least-once** delivery. The same event can arrive **more than once**.
- So every consumer must be **idempotent**: processing the same event twice must have the same effect as processing it once.
- Clean up old outbox rows on a schedule, because the table grows forever.

### Idempotency: how consumers handle duplicates (verified logic)
```js
const processed = new Set()          // in production: a DB table with a UNIQUE index on event_id
function handleOnce(eventId, fn) {
  if (processed.has(eventId)) return 'duplicate-skipped'
  processed.add(eventId)
  fn()
  return 'processed'
}
handleOnce('evt_1', ...)   // processed
handleOnce('evt_1', ...)   // duplicate-skipped
```

---

## Level 7: Real world, payment webhooks

**A webhook is the Observer pattern across companies.**
- The payment provider is the event producer and the subject.
- Your server is an observer.
- "Subscribe" = registering your webhook URL in their dashboard.
- "Notify" = they send an HTTP POST to your URL.

This is exactly our project's "payment done" event, in production.

### Razorpay (verified from the official docs)
- **Payment events:**
  - `payment.authorized`, `payment.captured`, `payment.failed`.
  - Order event: `order.paid`.
  - Payment Link event: `payment_link.paid`.
- **Which event means "money received":** use `payment.captured` or `order.paid`. `payment.authorized` describes the authorization, not the capture.
- **Signature check:**
  - The signature is in the `X-Razorpay-Signature` header.
  - It is an **HMAC SHA-256** of the **raw request body**, using your webhook secret.
  - Docs: *"Do not parse or cast the webhook request body"* before validating.
  - If you rotate the secret, validate retried old requests with the **old** secret.
- **Duplicates:** the `x-razorpay-event-id` header is unique per event. Duplicate delivery is *"expected behaviour based on the webhook design"*, so store the IDs you have processed.
- **Order:** events usually arrive in order (`payment.authorized` then `payment.captured`), but the docs say this order *"may not be followed at all times."* Your code must handle out-of-order events.

### Stripe (from community guides; check Stripe's official docs for exact numbers)
- The main success event is `payment_intent.succeeded`.
- **Retries are normal.** Failed deliveries are retried for a long time, so duplicates will happen.
- **Deduplicate on the event ID, and also on the business object ID** (for example the payment intent ID). One business outcome can produce several different event types.
- **Return codes matter:**
  - Return **2xx** only when the event is safely stored or processed.
  - Return **5xx** when processing failed, so the provider retries.
  - Return **2xx** for duplicates you have already handled.
- **Answer fast**, and do the heavy work in the background.
- **Always verify the signature.** Otherwise anyone can fake a "payment succeeded" event.

### A production webhook handler (Express)
This brings everything together: signature check, idempotency, fast answer, a background job, and observers. *(Sketch: `webhookInbox` and `jobs` stand in for your own DB table and queue. `isValidSignature` was verified.)*

```js
import express from 'express'
import { createHmac, timingSafeEqual } from 'node:crypto'

function isValidSignature(rawBody, signature, secret) {
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
  const a = Buffer.from(expected)
  const b = Buffer.from(signature ?? '')
  return a.length === b.length && timingSafeEqual(a, b)     // constant-time compare
}

app.post('/webhooks/razorpay',
  express.raw({ type: 'application/json' }),                // keep the RAW body
  async (req, res) => {
    const ok = isValidSignature(req.body, req.get('x-razorpay-signature'), process.env.RAZORPAY_WEBHOOK_SECRET)
    if (!ok) return res.sendStatus(400)

    const eventId = req.get('x-razorpay-event-id')
    const { event, payload } = JSON.parse(req.body)

    const isNew = await webhookInbox.insertIfNew(eventId, event, payload)  // UNIQUE index on event_id
    if (isNew) await jobs.add('handle-razorpay-event', { eventId })        // heavy work happens in a worker
    res.sendStatus(200)                                                     // answer fast
  })

// worker: load the stored event → bus.publish(event, payload) → observers react → mark as done
```

Verified results of `isValidSignature`:
```
valid signature: true
tampered body:   false
missing header:  false
```

### Handling out-of-order events
- **Never move a status backwards.** If an order is already `paid`, ignore a late `payment.authorized`.
- Treat **final states** (paid, refunded, failed) as final.
- Each observer should check the current state in the database, not trust the event order.

---

## Level 8: Decision guide, pitfalls, exercises, Q&A

### Where you already see the Observer pattern
| Place | Subscribe | Notify |
|---|---|---|
| Our project | `subject.subscribe(obs)` | `subject.notify(data)` |
| Node.js `EventEmitter` | `.on('paid', fn)` | `.emit('paid', data)` |
| Node.js streams | `.on('data', fn)` | new data arrives |
| HTTP server | `server.on('request', fn)` | a request arrives |
| Process signals | `process.on('SIGTERM', fn)` | the OS sends a signal |
| Browser DOM | `addEventListener('click', fn)` | user clicks |
| Browser observers | `IntersectionObserver`, `MutationObserver`, `ResizeObserver` | element visible / DOM changed / size changed |
| React stores (Redux, Zustand) | `store.subscribe(fn)` | state changes |
| RxJS | `.subscribe()` | `.next(value)` |
| NestJS | `@OnEvent('payment.captured')` | `eventEmitter.emit(...)` |
| PostgreSQL | `LISTEN channel` | `NOTIFY channel` |
| MongoDB | change streams `watch()` | a document changes |
| Webhooks (Razorpay, Stripe, GitHub) | register a URL | HTTP POST to your URL |
| Kafka / RabbitMQ / SQS | consumer / queue binding | producer publishes |

### Which tool should I use?
| Situation | Use |
|---|---|
| Only one reaction, and it must succeed with the main action | **A direct function call.** No pattern needed. |
| Several small reactions, same process, OK to lose on a crash (logs, metrics, cache clear) | **`EventEmitter` / safe EventBus** (Level 5.1) |
| Reactions are slow or must not be lost (emails, PDFs, external APIs) | **Observer that enqueues a job** (Level 5.3) |
| Other services must react, and money or orders are involved | **Message broker + transactional outbox** (Level 6) |
| An external company tells you something happened | **Webhook handler with signature check + idempotency** (Level 7) |
| Steps must run in a strict order with rollback (debit, then credit) | **Not events.** Use explicit calls or a saga/workflow. |

### Pitfalls checklist
- [ ] Every observer handles its own errors (try/catch inside `update` or the handler).
- [ ] Async listeners: catch rejections, or use `captureRejections`, or a safe bus.
- [ ] Every emitter and stream you create has an `'error'` listener.
- [ ] Every `subscribe` / `on` has a matching `unsubscribe` / `off`. Watch for `MaxListenersExceededWarning`.
- [ ] `off()` uses the same function reference that `on()` used.
- [ ] No slow work directly inside `emit`. Hand it to a queue.
- [ ] Events carry only the data observers need. No secrets, no full card data.
- [ ] Event names are past tense and consistent: `payment.captured`, `order.paid`.
- [ ] Anything that crosses a process boundary is treated as at-least-once. Consumers are idempotent.
- [ ] Webhooks: verify the signature on the raw body, deduplicate by event ID, answer fast, handle out-of-order delivery.
- [ ] Don't build long chains of events that trigger events. It becomes hard to trace "what happens when X?". Keep a list of event names and their observers.

### Team exercises (easy → hard)
1. **Add an Invoice observer** to the project (Level 2). Confirm `payment.js` doesn't change.
2. **Write the missing test:** an observer that throws. First, assert the current behaviour (later observers don't run). Then change `notify` to isolate errors, and update the test.
3. **Add a "first purchase" coupon** observer that reacts only once, using `once()` semantics.
4. **Rewrite the project with `EventEmitter`** (or the EventBus from Level 5.1), using the event name `payment.captured`.
5. **Add `captureRejections`** and make one observer `async` and failing. Show that the process no longer crashes.
6. **Design on paper:** the outbox table and relay for `order.paid` in your current product. Which consumers must be idempotent?
7. **Find 3 places in your own codebase** with the "one event, many reactions" shape. Could they use events?

### Extended Q&A
**What is the difference between an event and an observer?**
The event is *what happened*. The observer is *who reacts* to it.

**Observer vs Pub/Sub: aren't they the same?**
They are close. In **Observer**, the subject holds direct references to its observers and calls them (our `PaymentSubject`). In **Pub/Sub**, a broker sits in between, messages are routed by topic, and publishers and subscribers don't know each other, often in different processes. `EventEmitter` with named events is in between.

**Is `notify` async?**
No. It calls observers one by one and waits for each to return. If an observer starts async work, `notify` doesn't wait for that work.

**Why a `Set` and not an array?**
No duplicates, a simple `delete`, and insertion order is kept.

**What does `#` mean?**
A private class field. Outside code cannot touch it.

**Can events cause memory leaks?**
Yes, if listeners are added and never removed. Node warns after 10 listeners on one event.

**Why did my process crash when an event fired?**
Either an `'error'` event had no listener, or an async listener rejected and nobody handled it.

**Do events guarantee delivery?**
In-memory events: no, they are lost on a crash. Brokers + outbox: at-least-once, so consumers must handle duplicates.

**Can events arrive out of order?**
Across networks, yes. Razorpay's docs say so explicitly. Design observers to check the current state.

**When should we NOT use events?**
When there is only one reaction, or when steps must happen in a strict order with rollback.

---

## Sources
- Our project: `01-ecommerce-app`, from Erick Wendel's *Mastering Node.js Streams* course.
- Node.js behaviour: tested locally on Node.js v22.16.0 (all "verified" outputs above).
- [Node.js Events documentation](https://nodejs.org/api/events.html)
- [Razorpay: Payments webhook events](https://razorpay.com/docs/webhooks/payments/)
- [Razorpay: All webhook events](https://razorpay.com/docs/webhooks/all)
- [Razorpay: Validate and test webhooks](https://razorpay.com/docs/webhooks/validate-test/)
- [NestJS: Events](https://docs.nestjs.com/techniques/events)
- [microservices.io: Transactional outbox](https://microservices.io/patterns/data/transactional-outbox.html)
- [microservices.io: Transaction log tailing](https://microservices.io/patterns/data/transaction-log-tailing.html)
- Stripe webhook practices (community guides; confirm with Stripe's official docs):
  - [Stripe webhooks in production: idempotency, retries](https://dev.to/alexcloudstar/stripe-webhooks-in-production-idempotency-retries-and-the-mistakes-that-cost-me-real-money-5haf)
  - [Payment webhook receiver design](https://www.techinterview.org/post/3233468243/lld-payment-webhook/)
  - [Idempotency: making webhooks safe to retry](https://inquir.org/blog/idempotency-making-webhooks-and-jobs-safe-to-retry)
