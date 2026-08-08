import { jest } from '@jest/globals'
export const natsWrapper = {
    client: {
        publish: jest.fn().mockImplementation((_subject: any, _data: any, callback: any) => {
            callback();
        })
    }
}
