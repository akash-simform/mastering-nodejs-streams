import Payment from "./events/payment.js";
import Invoice from "./observers/invoice.js";
import Marketing from "./observers/marketing.js";
import Shipment from "./observers/shipment.js";
import PaymentSubject from "./subjects/paymentSubject.js";

// create the subject that will broadcast payments
const subject = new PaymentSubject()

// subscribe marketing to payment updates
const marketing = new Marketing()
subject.subscribe(marketing)

// subscribe shipment to payment updates
const shipment = new Shipment()
subject.subscribe(shipment)

const invoice = new Invoice()
subject.subscribe(invoice)

// a payment notifies both marketing and shipment
const payment = new Payment(subject)
payment.creditCard({id : 1 , username : 'Test One' , age : 27})

// marketing stops listening
subject.unsubscribe(marketing)

// this will only trigger the shipment area
payment.creditCard({id : 2 , username : 'Test Two' , age : 27})
