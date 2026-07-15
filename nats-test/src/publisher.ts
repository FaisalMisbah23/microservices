import nats from 'node-nats-streaming'
import { TicketCreatedPublisher } from './events/ticket-created-publisher'

console.clear()

// const client = nats.connect()
const stan = nats.connect('ticketing', 'abc', {
    url: 'http://localhost:4222'
})

stan.on('connect', async () => {
    console.log('Publisher connected to NATS')

    try {
        const publisher = new TicketCreatedPublisher(stan)
        await publisher.publish({
            id: '123',
            title: 'xyz',
            price: 20
        })
    } catch (error) {
        console.log(error)
    }

    // const data = JSON.stringify({
    //     id: '123',
    //     title: 'abc',
    //     price: 20
    // })

    // setTimeout(() => {
    //     stan.publish('ticket:created', data, () => {
    //         console.log('Event published')
    //     })
    // }, 1000)
})