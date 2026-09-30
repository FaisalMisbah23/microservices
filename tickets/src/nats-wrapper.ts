import nats, { Stan } from 'node-nats-streaming'
import { randomUUID } from 'node:crypto'

class NatsWrapper {
    private _client?: Stan;

    get client(): Stan {
        if (!this._client) {
            throw new Error('Cannot access NATS client before connecting')
        }

        return this._client
    }

    connect(clusterId: string, clientId: string, url: string) {
        // NATS Streaming rejects a second connection reusing a live clientID. A
        // fixed NATS_CLIENT_ID collides with the outgoing instance whenever a
        // deploy overlaps it, so the connection dies with "clientID already
        // registered" and the new build never passes its health check. Suffixing
        // per process keeps rolling deploys from fighting each other; the queue
        // group still does the load balancing.
        const uniqueClientId = `${clientId}-${randomUUID().slice(0, 8)}`

        this._client = nats.connect(clusterId, uniqueClientId, {
            url,
            ...(process.env.NATS_TOKEN ? { token: process.env.NATS_TOKEN } : {})
        })

        return new Promise<void>((resolve, reject) => {
            this._client?.on('connect', () => {
                console.log('Connected to NATS')
                resolve()
            })
            this._client?.on('error', (err) => {
                reject(err)
            })
        })
    }
}

export const natsWrapper = new NatsWrapper();