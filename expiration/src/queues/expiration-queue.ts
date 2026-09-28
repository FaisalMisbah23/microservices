import Queue from 'bull'
import { natsWrapper } from '../nats-wrapper'
import { ExpirationCompletePublisher } from '../events/listeners/publisher/expiration-complete-publisher'


interface Payload
{
    orderId: string
}

const expirationQueue = new Queue<Payload>('order-expiration', {
    redis: {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT || 6379),
        // Required whenever the server runs with requirepassword, otherwise
        // Bull's connection is rejected with NOAUTH and jobs never process.
        ...(process.env.REDIS_PASSWORD ? { password: process.env.REDIS_PASSWORD } : {})
    }
})

expirationQueue.process(async (job) => {
    console.log('Publishing expiration:complete event for orderId', job.data.orderId)

    await new ExpirationCompletePublisher(natsWrapper.client).publish({
        orderId: job.data.orderId
    })
})

export { expirationQueue }