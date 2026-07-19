import { it } from '@jest/globals'
import { Ticket } from '../ticket'

it('implements optimistic concurrency control', async () => {
    // create an instance of a ticket
    const ticket = Ticket.build({
        title: 'my ticket',
        price: 10,
        userId: "12345"
    })

    // save the ticket to the database 
    await ticket.save();

    // fetch the ticket twice 
    const firstInstance = await Ticket.findById(ticket.id);
    const secondInstance = await Ticket.findById(ticket.id);

    // make two separate changes to the tickets we fetched 
    firstInstance!.set({ price: 50 })
    secondInstance!.set({ price: 100 })

    // save the first fetch ticket 
    await firstInstance!.save()

    // save the second fetched ticket and expect an error
    try {
        await secondInstance!.save()
    } catch (error) {
        return;
    }

    throw new Error('Should not read this point')
})

it('increment the version number on multiple saves', async () => {
    const ticket = Ticket.build({
        title: 'new ticket',
        price: 10,
        userId: "12345"
    })

    await ticket.save();
    expect(ticket.version).toEqual(0)
    ticket.set({ price: 100 })
    await ticket.save();
    expect(ticket.version).toEqual(1)
    ticket.set({ price: 50 })
    await ticket.save();
    expect(ticket.version).toEqual(2)
})