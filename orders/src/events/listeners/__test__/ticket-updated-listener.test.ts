import { jest, it, expect } from '@jest/globals'
import { TicketUpdatedListener } from '../ticket-updated-listener'
import { natsWrapper } from '../../../nats-wrapper'
import { Ticket } from '../../../models/ticket'
import mongoose from 'mongoose'
import { TicketUpdatedEvent } from '@fmticketflow/common'
import { Message } from 'node-nats-streaming'

const setup = async () => {
    // create a listener 
    const listener = new TicketUpdatedListener(natsWrapper.client)

    // create and save a ticket 
    const ticket = Ticket.build({
        id: new mongoose.Types.ObjectId().toHexString(),
        title: "match ticket",
        price: 200
    })

    await ticket.save();

    // create a fake data object
    const data: TicketUpdatedEvent['data'] = {
        id: ticket.id,
        version: ticket.version + 1,
        title: "final match ticket",
        price: 250,
        userId: '12345'
    }

    // create a fake msg object
    // @ts-ignore
    const msg: Message = {
        ack: jest.fn()
    }

    // return all of this stuff
    return { listener, data, ticket, msg }

}

it('finds, updates, and saved a ticket', async () => {
    const { listener, data, ticket, msg } = await setup();

    await listener.onMessage(data, msg)

    const updatedTicket = await Ticket.findById(ticket.id)

    expect(updatedTicket!.title).toEqual(data.title)
    expect(updatedTicket!.price).toEqual(data.price)
    expect(updatedTicket!.version).toEqual(data.version)



})


it('acks the message', async () => {
    const { listener, data, ticket, msg } = await setup();

    await listener.onMessage(data, msg)

    expect(msg.ack).toHaveBeenCalled()
})

it('does not call ack if the event has a skipped version number', async () => {
    const { listener, data, ticket, msg } = await setup();
    data.version = 10;

    try {
        await listener.onMessage(data, msg)
    } catch (error) {
    }

    expect(msg.ack).not.toHaveBeenCalled()
})