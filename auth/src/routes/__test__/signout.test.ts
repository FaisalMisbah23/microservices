import { expect, it } from "@jest/globals"
import request from "supertest"
import { app } from "../../app"


it('responds with a cookie when given valid credentials', async () => {
    await request(app)
        .post('/api/users/signup')
        .send({
            email: 'test@test.com',
            password: 'password'
        })
        .expect(201)

    const response = await request(app)
        .post('/api/users/signout')
        .send({})
        .expect(200)

    const cookie = response.get('Set-Cookie');

    if (!cookie) throw new Error('Expected cookie but got undefined');

    const cookieValue = Array.isArray(cookie) ? cookie[0] : cookie;

    expect(cookieValue).toEqual('session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; httponly')
})