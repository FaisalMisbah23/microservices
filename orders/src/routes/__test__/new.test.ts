import { it } from '@jest/globals'
import request from 'supertest';
import mongoose from 'mongoose'
import { app } from '../../app';
import { Ticket } from '../../models/ticket';
import { OrderStatus } from '@fmticketflow/common';
import { Order } from '../../models/order';

it('return an error if the ticket does not exist', async () => {
    const ticketId = new mongoose.Types.ObjectId();

    request(app).post('/api/orders')
        .set('Cookie', global.signin())
        .send({ ticketId })
        .expect(404)
})

it('return an error if the ticket is already reserved', async () => {
    const ticket = Ticket.build({
        title: 'match ticket',
        price: 20
    })

    await ticket.save();

    const order = Order.build({
        ticket,
        userId: '123456789',
        status: OrderStatus.Created,
        expiresAt: new Date()
    })

    await order.save()

    request(app).post('/api/orders')
        .set('Cookie', global.signin())
        .send({ ticketId: ticket.id })
        .expect(400)
})

it('reserve a ticket', async () => {
    const ticket = Ticket.build({
        title: 'match ticket',
        price: 20
    })

    await ticket.save();

    const order = Order.build({
        ticket,
        userId: '123456789',
        status: OrderStatus.Created,
        expiresAt: new Date()
    })

    await order.save()

    request(app).post('/api/orders')
        .set('Cookie', global.signin())
        .send({ ticketId: ticket.id })
        .expect(201)
})

it.todo('emits an order created event')
