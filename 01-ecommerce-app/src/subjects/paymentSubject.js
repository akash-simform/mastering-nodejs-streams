// Subject: keeps a list of observers and sends data to all of them
export default class PaymentSubject {

  // Set avoids adding the same observer twice
  #observers = new Set()

  // send data to every subscribed observer
  notify(data) {
    this.#observers.forEach(observer => observer.update(data))
  }

  // remove an observer so it stops receiving updates
  unsubscribe(observable) {
    this.#observers.delete(observable)
  }

  // add an observer so it starts receiving updates
  subscribe(observable) {
    this.#observers.add(observable)
  }

}
