import mongoose from 'mongoose'

interface TicketAttrs {
    title: string
    price: number
    userId: string
}

interface TicketDoc extends mongoose.Document {
    title: string
    price: number
    userId: string
}

interface TicketModel extends mongoose.Model<TicketDoc> {
    build(attr: TicketAttrs): TicketDoc
}

const ticketSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    }, price: {
        type: Number,
        required: true
    }, userId: {
        type: String,
        required: true
    }
}, {
    toJSON: {
        transform(doc, ret: any) {
            ret.id = ret._1d ?? ret._id;
            delete ret._id;
        }
    }
})

ticketSchema.statics.build = (attrs: TicketAttrs) => {
    return new Ticket(attrs);
}

const Ticket = mongoose.model<TicketDoc, TicketModel>('Ticket', ticketSchema);

export { Ticket };