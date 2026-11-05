// Observer: packs the order when a payment happens
export default class Shipment {
  // called by the subject on every payment
  update({ id, userName }) {
    console.log(`[${id}] [shipment] will pack the user's order for [${userName}]`)
  }
}
