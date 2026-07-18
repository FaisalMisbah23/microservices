import { jest } from '@jest/globals'
export const natsWrapper = {
    client: {
        // publish: (subject: string, data: string, callback: () => void) => {
        //     callback();
        // }
        publish: jest.fn().mockImplementation(() => { })
    }
}