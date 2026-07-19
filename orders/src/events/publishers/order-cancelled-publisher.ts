import { Publisher, Subjects, OrderCancelledEvent } from "@fmticketflow/common";

export class OrderCancelledPublisher extends Publisher<OrderCancelledEvent> {
    subject: Subjects.OrderCancelled = Subjects.OrderCancelled
}