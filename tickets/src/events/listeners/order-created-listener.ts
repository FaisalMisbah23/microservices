import { Listener, OrderCreatedEvent, OrderStatus, Subjects } from "@fmticketflow/common";
import { queueGroupName } from './queue-group-name'
import { Message } from "node-nats-streaming";
import { Ticket } from "../../models/ticket";
import { TicketUpdatedPublisher } from "../publishers/ticket-updated-publisher";

export class OrderCreatedListener extends Listener<OrderCreatedEvent> {
    subject: Subjects.OrderCreated = Subjects.OrderCreated
    queueGroupName = queueGroupName

    async onMessage(data: OrderCreatedEvent['data'], msg: Message) {
        // find the ticket that the order is reserving 
        const ticket = await Ticket.findById(data.ticket.id)

        // if not ticket throw error 
        if (!ticket) {
            throw new Error('Ticket not found')
        }

        // mark the ticket as begin reserved by setting its orderId property
        ticket.set({ orderId: data.id })
        await new TicketUpdatedPublisher(this.client).publish({
            id: ticket.id,
            title: ticket.title,
            price: ticket.price,
            userId: ticket.userId,
            version: ticket.version,
            orderId: ticket.orderId
        })

        // save the ticket 
        await ticket.save()

        // ack the message
        msg.ack()
    }
}