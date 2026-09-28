import mongoose from 'mongoose'
import { app } from './app'

const start = async () => {
  if (!process.env.JWT_KEY) {
    throw new Error('JWT_KEY must be defined')
  }

  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI must be defined')
  }

  const mongoUri = process.env.MONGO_URI

  try {
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
    console.log('Connected to auth MongoDb')
  } catch (error) {
    console.error('Failed to start', error)
    process.exit(1)
  }

  app.listen(process.env.PORT || 3000, () => {
    console.log('Listening on port 3000');
  });

}


start();