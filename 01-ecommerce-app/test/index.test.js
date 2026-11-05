import { expect, describe, test, jest, beforeEach } from '@jest/globals'
import PaymentSubject from '../src/subjects/paymentSubject.js'
import Payment from '../src/events/payment.js'
import Marketing from '../src/observers/marketing.js'
import Shipment from '../src/observers/shipment.js'

describe('Test Suite for Observer Pattern', () => {
  // hide console output during tests
  beforeEach(() => {
    jest.restoreAllMocks()
    jest.spyOn(console, 'log').mockImplementation(() => {})
  })

  // 1. Subject: keeps a list of observers and notifies them
  describe('PaymentSubject', () => {
    test('should not fail when notifying with no observers', () => {
      const subject = new PaymentSubject()
      expect(() => subject.notify({ id: 1 })).not.toThrow()
    })

    test('should call update() on a subscribed observer with the data', () => {
      const subject = new PaymentSubject()
      const observer = { update: jest.fn() }
      const data = { id: 1, userName: 'Test One' }

      subject.subscribe(observer)
      subject.notify(data)

      expect(observer.update).toHaveBeenCalledWith(data)
    })

    test('should notify every subscribed observer', () => {
      const subject = new PaymentSubject()
      const first = { update: jest.fn() }
      const second = { update: jest.fn() }

      subject.subscribe(first)
      subject.subscribe(second)
      subject.notify({ id: 1 })

      expect(first.update).toHaveBeenCalledTimes(1)
      expect(second.update).toHaveBeenCalledTimes(1)
    })

    test('should notify the same observer only once even if subscribed twice', () => {
      const subject = new PaymentSubject()
      const observer = { update: jest.fn() }

      subject.subscribe(observer)
      subject.subscribe(observer)
      subject.notify({ id: 1 })

      expect(observer.update).toHaveBeenCalledTimes(1)
    })

    test('should stop notifying an observer after unsubscribe', () => {
      const subject = new PaymentSubject()
      const observer = { update: jest.fn() }

      subject.subscribe(observer)
      subject.unsubscribe(observer)
      subject.notify({ id: 1 })

      expect(observer.update).not.toHaveBeenCalled()
    })
  })

  // 2. Event: a payment tells the subject that something happened
  describe('Payment', () => {
    test('should notify the subject with id and userName on credit card payment', () => {
      const subject = new PaymentSubject()
      const notifySpy = jest.spyOn(subject, 'notify')
      const payment = new Payment(subject)

      payment.creditCard({ id: 1, username: 'Test One', age: 27 })

      expect(notifySpy).toHaveBeenCalledWith({ id: 1, userName: 'Test One' })
    })
  })

  // 3. Observers: each one reacts to the payment in its own way
  describe('Observers', () => {
    test('Marketing should log a welcome email message', () => {
      new Marketing().update({ id: 1, userName: 'Test One' })

      expect(console.log).toHaveBeenCalledWith(
        '[1] [marketing] will send a welcome email to [Test One]'
      )
    })

    test('Shipment should log a pack order message', () => {
      new Shipment().update({ id: 1, userName: 'Test One' })

      expect(console.log).toHaveBeenCalledWith(
        "[1] [shipment] will pack the user's order for [Test One]"
      )
    })
  })

  // 4. Full flow: payment -> subject -> all observers
  describe('Integration', () => {
    test('should notify marketing and shipment when a payment happens', () => {
      const subject = new PaymentSubject()
      const marketing = new Marketing()
      const shipment = new Shipment()
      const marketingSpy = jest.spyOn(marketing, 'update')
      const shipmentSpy = jest.spyOn(shipment, 'update')

      subject.subscribe(marketing)
      subject.subscribe(shipment)
      new Payment(subject).creditCard({ id: 1, username: 'Test One', age: 27 })

      const expected = { id: 1, userName: 'Test One' }
      expect(marketingSpy).toHaveBeenCalledWith(expected)
      expect(shipmentSpy).toHaveBeenCalledWith(expected)
    })

    test('should notify only shipment after marketing unsubscribes', () => {
      const subject = new PaymentSubject()
      const marketing = new Marketing()
      const shipment = new Shipment()
      const marketingSpy = jest.spyOn(marketing, 'update')
      const shipmentSpy = jest.spyOn(shipment, 'update')

      subject.subscribe(marketing)
      subject.subscribe(shipment)
      subject.unsubscribe(marketing)
      new Payment(subject).creditCard({ id: 2, username: 'Test Two', age: 27 })

      expect(marketingSpy).not.toHaveBeenCalled()
      expect(shipmentSpy).toHaveBeenCalledWith({ id: 2, userName: 'Test Two' })
    })
  })
})
