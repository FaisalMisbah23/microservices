import express from 'express';
import { json } from 'body-parser';
import 'express-async-errors'
import { NotFoundError, currentUser, errorHandler } from '@fmticketflow/common';
import cookieSession from 'cookie-session';
import { healthRouter } from './routes/health';
import { indexOrderRouter } from './routes';
import { newOrderRouter } from './routes/new';
import { deleteOrderRouter } from './routes/delete';
import { showOrderRouter } from './routes/show';

const app = express();

app.set('trust proxy', true);
app.use(json());
app.use(cookieSession({
  signed: false,
  // Was NODE_ENV !== 'test', which silently disables the session cookie over
  // plain HTTP: signup returns 201 with no Set-Cookie and every later write
  // 401s. Opt out explicitly with COOKIE_SECURE=false for a local boot.
  secure: process.env.COOKIE_SECURE !== 'false'
}) as any)

app.use(currentUser as any)
app.use(indexOrderRouter);
app.use(newOrderRouter);
app.use(deleteOrderRouter);
app.use(showOrderRouter);

app.use(healthRouter);

app.all('*', async () => {
  throw new NotFoundError();
})

// app.all('*',async (req,res,next)=>{
//   next(new NotFoundError());
// })


app.use(errorHandler as any)

export { app };