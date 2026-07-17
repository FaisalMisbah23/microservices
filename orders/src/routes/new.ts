import { BadRequestError, NotFoundError, OrderStatus, RequireAuth, validateRequest } from '@fmticketflow/common';
import express, { Request, Response } from 'express'
import { body } from 'express-validator';
import mongoose from 'mongoose';
import { Ticket } from '../models/ticket'
import { Order } from '../models/order';

const router = express.Router();

router.post('/api/orders', RequireAuth, [
    body('ticketId')
        .not()
        .isEmpty()
        .custom((input) => mongoose.Types.ObjectId.isValid(input)) // *coupling*
        .withMessage('TicketId must be provided')
], validateRequest, async (req: Request, res: Response) => {

    const { ticketId } = req.body;

    // find the ticket the user is trying to order in the database
    const ticket = await Ticket.findById(ticketId)
    if (!ticket) {
        throw new NotFoundError();
    }

    // make sure that this ticket is not already reserved
    // run query to look at all orders. find an order where the ticket is the ticket we just found *and* the orders status is *not* cancelled. if we find an order from that means the ticket *is* reserved
    const existingOrder = await Order.findOne({
        ticket: ticket,
        status: {
            $in: [
                OrderStatus.Created,
                OrderStatus.AwaitingPayment,
                OrderStatus.Complete
            ]
        }
    })

    if (existingOrder) {
        throw new BadRequestError('Ticket is already reserved')
    }

    // calculate an expiration date for this order 

    // build the order and save it to the database 

    // publish an event saying that an order was created

    res.send({})
})

export { router as newOrderRouter }