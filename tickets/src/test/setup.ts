import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose';
import { beforeAll, beforeEach, afterAll } from '@jest/globals';
import request from 'supertest';
import { app } from '../app';
import jwt from 'jsonwebtoken'

declare global {
    namespace NodeJS {
        export interface Global {
            signin: () => string[]
        }
    }
}

let mongo: any

beforeAll(async () => {
    process.env.JWT_KEY = 'secret'

    mongo = await MongoMemoryServer.create();
    const mongoUri = mongo.getUri();

    await mongoose.connect(mongoUri, {});
}, 30000)

beforeEach(async () => {
    const db = mongoose.connection.db;
    if (!db) return;

    const collections = await db.collections();

    for (const collection of collections) {
        await collection.deleteMany({});
    }
})

afterAll(async () => {
    if (mongo) {
        await mongo.stop();
    }

    if (mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
    }
}, 60000)

global.signin = () => {
    // build a jwt payload 
    const payload = {
        // id: '12345',
        id: new mongoose.Types.ObjectId().toHexString(),
        email: 'test@test.com'
    }

    // create the jwt 
    const token = jwt.sign(payload, process.env.JWT_KEY!)

    // build session object 
    const session = { jwt: token }

    // turn that session into json 
    const sessionJson = JSON.stringify(session);

    // take json and encode it as base64
    const base64 = Buffer.from(sessionJson).toString('base64')

    // return a string that the cookie with the encoded data 
    return [`session=${base64}`]
}