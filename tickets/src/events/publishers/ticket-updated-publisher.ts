import { Publisher, Subjects, TicketUpdatedEvent } from "@fmticketflow/common";

export class TicketUpdatedPublisher extends Publisher<TicketUpdatedEvent> {
    subject: Subjects.TicketUpdated = Subjects.TicketUpdated
}