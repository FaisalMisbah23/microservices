import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose';
import { beforeAll, beforeEach, afterAll } from '@jest/globals';
import request from 'supertest';
import { app } from '../app';

declare global {
    namespace NodeJS {
        export interface Global {
            signin: () => Promise<string[]>
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

global.signin = async () => {
    const response = await request(app)
        .post('/api/users/signup')
        .send({
            email: 'test@test.com',
            password: 'password'
        })
        .expect(201)

    const cookie = response.get('Set-Cookie')

    if (!cookie) {
        throw new Error('Failed to get cookie from response')
    }

    return cookie
}