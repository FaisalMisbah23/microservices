import mongoose from 'mongoose'
import { app } from './app'
import { natsWrapper } from './nats-wrapper'
import { OrderCancelledListener } from './events/listeners/order-cancelled-listener'
import { OrderCreatedListener } from './events/listeners/order-created-listener'

const start = async () => {
  if (!process.env.JWT_KEY) {
    throw new Error('JWT_KEY must be defined')
  }

  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI must be defined')
  }


  if (!process.env.NATS_CLUSTER_ID) {
    throw new Error('NATS_CLUSTER_ID must be defined')
  }


  if (!process.env.NATS_URL) {
    throw new Error('NATS_URL must be defined')
  }

  if (!process.env.NATS_CLIENT_ID) {
    throw new Error('NATS_CLIENT_ID must be defined')
  }

  if (!process.env.STRIPE_KEY) {
    throw new Error('STRIPE_KEY must be defined')
  }

  const mongoUri = process.env.MONGO_URI

  try {
    await natsWrapper.connect(process.env.NATS_CLUSTER_ID, process.env.NATS_CLIENT_ID, process.env.NATS_URL)

    natsWrapper.client.on('close', () => {
      console.log('NATS connection closed')
      process.exit();

    })

    process.on('SIGINT', () => natsWrapper.client.close());
    process.on('SIGTERM', () => natsWrapper.client.close())

    new OrderCreatedListener(natsWrapper.client).listen();
    new OrderCancelledListener(natsWrapper.client).listen()

    // A socket can die while the process stays up (idle suspend, Atlas
    // restart, a network blip). Reconnecting on 'disconnected' is what
    // actually recovers it: the timeout options only make the failure
    // visible sooner.
    mongoose.connection.on('disconnected', () => {
      console.log('MongoDb disconnected, attempting reconnect')
      mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      maxPoolSize: 5,
      heartbeatFrequencyMS: 10000
    }).catch((err) =>
        console.error('MongoDb reconnect failed', err)
      )
    })

    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      maxPoolSize: 5,
      heartbeatFrequencyMS: 10000
    })
    console.log('Connected to payments MongoDb')
  } catch (error) {
    console.error('Failed to start', error)
    process.exit(1)
  }

  app.listen(process.env.PORT || 3000, () => {
    console.log('Listening on port 3000');
  });

}


start();