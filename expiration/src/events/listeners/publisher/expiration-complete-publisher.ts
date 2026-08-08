import { ExpirationCompleteEvent, Publisher, Subjects } from "@fmticketflow/common";

export class ExpirationCompletePublisher  extends Publisher<ExpirationCompleteEvent> {
    subject: Subjects.ExpirationComplete = Subjects.ExpirationComplete
    
}