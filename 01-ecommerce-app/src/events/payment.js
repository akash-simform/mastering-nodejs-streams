// Event: a payment happens and the subject tells all observers about it
export default class Payment {
  constructor(paymentSubject) {
    this.paymentSubject = paymentSubject
  }

  // process the payment, then notify observers with id and userName
  creditCard({ id, username, age }) {
    console.log(`\na payment occurred from ${username}`)
    this.paymentSubject.notify({ id, userName: username })
  }
}
