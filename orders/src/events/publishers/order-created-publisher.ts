import { Publisher, OrderCreatedEvent,Subjects } from "@fmticketflow/common";

export class OrderCreatedPublisher extends Publisher<OrderCreatedEvent> {
    subject: Subjects.OrderCreated = Subjects.OrderCreated;
}