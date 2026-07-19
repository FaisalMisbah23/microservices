import { expect, it } from '@jest/globals'
import { Ticket } from '../../models/ticket'
import request from 'supertest'
import { app } from '../../app'
import { OrderStatus } from '@fmticketflow/common'
import { Order } from '../../models/order'
import { natsWrapper } from '../../nats-wrapper'
import mongoose from 'mongoose'

it('marks an order as cancelled', async () => {
    // create a ticket with ticket model
    const ticket = Ticket.build({
        id: new mongoose.Types.ObjectId().toHexString(),
        title: 'new ticket',
        price: 50
    })

    await ticket.save()

    const user = global.signin()
    // make a request to build an order with this ticket 
    const { body: order } = await request(app)
        .post('/api/orders')
        .set('Cookie', user)
        .send({
            ticketId: ticket.id
        })
        .expect(201)

    // make request to cancel the order 
    await request(app)
        .delete(`/api/orders/${order.id}`)
        .set('Cookie', user)
        .send()
        .expect(204)

    const updatedOrder = await Order.findById(order.id)
    expect(updatedOrder!.status).toEqual(OrderStatus.Cancelled)
})

it('emits a order cancelled event', async () => {
    // create a ticket with ticket model
    const ticket = Ticket.build({
        id: new mongoose.Types.ObjectId().toHexString(),
        title: 'new ticket',
        price: 50
    })

    await ticket.save()

    const user = global.signin()
    // make a request to build an order with this ticket 
    const { body: order } = await request(app)
        .post('/api/orders')
        .set('Cookie', user)
        .send({
            ticketId: ticket.id
        })
        .expect(201)

    // make request to cancel the order 
    await request(app)
        .delete(`/api/orders/${order.id}`)
        .set('Cookie', user)
        .send()
        .expect(204)

    expect(natsWrapper.client.publish).toHaveBeenCalled()
})