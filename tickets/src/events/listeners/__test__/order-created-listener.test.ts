import { it, jest, expect } from '@jest/globals'
import { OrderCreatedListener } from '../order-created-listener'
import { natsWrapper } from '../../../nats-wrapper'
import { Ticket } from '../../../models/ticket'
import { OrderCreatedEvent, OrderStatus } from '@fmticketflow/common'
import mongoose from 'mongoose'
import { Message } from 'node-nats-streaming'

const setup = async () => {
    // create an instance of the listener
    const listener = new OrderCreatedListener(natsWrapper.client)

    // create and save a ticket 
    const ticket = Ticket.build({
        title: 'new ticket',
        price: 100,
        userId: '12345'
    })

    await ticket.save();

    // create the fake data 
    const data: OrderCreatedEvent['data'] = {
        id: new mongoose.Types.ObjectId().toHexString(),
        version: 0,
        status: OrderStatus.Created,
        expiresAt: "12345",
        userId: '12345',
        ticket: { id: ticket.id, price: ticket.price }
    }

    // @ts-ignore
    const msg: Message = {
        ack: jest.fn()
    }

    return { listener, ticket, data, msg }
}

it('sets the userId of the ticket', async () => {
    const { listener, ticket, data, msg } = await setup()

    await listener.onMessage(data, msg)

    const updatedTicket = await Ticket.findById(ticket.id)

    expect(updatedTicket!.orderId).toEqual(data.id)
})

it('acks the message', async () => {
    const { listener, ticket, data, msg } = await setup()

    await listener.onMessage(data, msg)

    expect(msg.ack).toHaveBeenCalled()
})


it('published a ticket updated event', async () => {
    const { listener, ticket, data, msg } = await setup()

    await listener.onMessage(data, msg)

    expect(natsWrapper.client.publish).toHaveBeenCalled()

    const ticketUpdatedData = JSON.parse((natsWrapper.client.publish as jest.Mock).mock.calls[0][1] as string)

    expect(ticketUpdatedData!.orderId).toEqual(data.id)
})