import { Publisher, Subjects, TicketCreatedEvent } from "@fmticketflow/common";

export class TicketCreatedPublisher extends Publisher<TicketCreatedEvent> {
    subject: Subjects.TicketCreated = Subjects.TicketCreated
}