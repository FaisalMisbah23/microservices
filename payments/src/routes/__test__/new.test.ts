import { it, expect, jest } from '@jest/globals'
import { app } from '../../app'
import mongoose from 'mongoose'
import request from 'supertest'
import { OrderStatus } from '@fmticketflow/common/build/events/types/order-status'
import { Order } from '../../models/order'
import { stripe } from '../../stripe'
import { Payment } from '../../models/payment'

// Mock the stripe module
// jest.mock('../../stripe')

it('returns a 404 when purchasing an order that does not exist', async () => {
    await request(app)
        .post('/api/payments')
        .set('Cookie', global.signin())
        .send({
            token: 'asdasd',
            orderId: new mongoose.Types.ObjectId().toHexString()
        })
        .expect(404)
})

it('returns a 401 when purchasing an order that does not belong to the user', async () => {
    const order = Order.build({
        id: new mongoose.Types.ObjectId().toHexString(),
        userId: new mongoose.Types.ObjectId().toHexString(),
        version: 0,
        price: 20,
        status: OrderStatus.Created
    })

    await order.save()

    await request(app)
        .post('/api/payments')
        .set('Cookie', global.signin())
        .send({
            token: 'asdasd',
            orderId: order.id
        })
        .expect(401)
})

it('returns a 400 when purchasing a cancelled order', async () => {
    const userId = new mongoose.Types.ObjectId().toHexString()
    const order = Order.build({
        id: new mongoose.Types.ObjectId().toHexString(),
        userId,
        version: 0,
        price: 20,
        status: OrderStatus.Cancelled
    })

    await order.save()

    await request(app)
        .post('/api/payments')
        .set('Cookie', global.signin(userId))
        .send({
            token: 'asdasd',
            orderId: order.id
        })
        .expect(400)
})

it('returns a 201 with valid inputs', async () => {
    const userId = new mongoose.Types.ObjectId().toHexString()
    const price = Math.floor(Math.random() * 100000)
    const order = Order.build({
        id: new mongoose.Types.ObjectId().toHexString(),
        userId,
        version: 0,
        price,
        status: OrderStatus.Created
    })

    await order.save()

    await request(app)
        .post('/api/payments')
        .set('Cookie', global.signin(userId))
        .send({
            token: 'tok_visa',
            orderId: order.id
        })
        .expect(201)

    const stripeCharges = await stripe.charges.list({ limit: 10 })
    const stripeCharge = stripeCharges.data.find(charge => {
        return charge.amount === price * 100
    })

    expect(stripeCharge).toBeDefined() // Check if a charge with the correct amount was created
    // ! for TypeScript to know that stripeCharge is not undefined
    expect(stripeCharge!.currency).toEqual('usd')


    const payment = await Payment.findOne({
        orderId: order.id,
        stripeId: stripeCharge!.id
    })

    // undefined and null are different in JavaScript. undefined means a variable has been declared but has not yet been assigned a value, while null is an assignment value that represents no value or no object. In this case, we want to check if the payment record exists in the database, so we use not.toBeNull() to ensure that the payment variable is not null, indicating that a payment record was successfully created and saved in the database.
    expect(payment).not.toBeNull() // Check if a payment record was created in the database

})

//     const chargeOptions = (stripe.charges.create as jest.Mock).mock.calls[0][0] as {
//         source: string
//         amount: number
//         currency: string
//     }
//     expect(chargeOptions.source).toEqual('tok_visa')
//     expect(chargeOptions.amount).toEqual(20 * 100)
//     expect(chargeOptions.currency).toEqual('usd')
// })