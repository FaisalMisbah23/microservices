import express from 'express';
import { json } from 'body-parser';
import 'express-async-errors'

import { currentUserRouter } from './routes/current-user';
import { signinRouter } from './routes/signin';
import { signoutRouter } from './routes/signout';
import { signupRouter } from './routes/signup';
import { NotFoundError,errorHandler } from '@fmticketflow/common';
import cookieSession from 'cookie-session';

const app = express();

app.set('trust proxy',true);
app.use(json());
app.use(cookieSession({
  signed:false,
  // Was NODE_ENV !== 'test', which silently disables the session cookie over
  // plain HTTP: signup returns 201 with no Set-Cookie and every later write
  // 401s. Opt out explicitly with COOKIE_SECURE=false for a local boot.
  secure: process.env.COOKIE_SECURE !== 'false'
}))

app.use(currentUserRouter);
app.use(signinRouter);
app.use(signoutRouter);
app.use(signupRouter);

app.all('*', async () => {
  throw new NotFoundError();
})

// app.all('*',async (req,res,next)=>{
//   next(new NotFoundError());
// })


app.use(errorHandler)

export {app};