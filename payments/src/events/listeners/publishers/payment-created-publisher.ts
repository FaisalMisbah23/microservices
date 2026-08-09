import { PaymentCreatedEvent, Publisher, Subjects } from "@fmticketflow/common";

export class PaymentCreatedPublisher extends Publisher<PaymentCreatedEvent> {
    subject: Subjects.PaymentCreated = Subjects.PaymentCreated;
}