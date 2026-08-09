import express from 'express';
import { json } from 'body-parser';
import 'express-async-errors'
import { NotFoundError, currentUser, errorHandler } from '@fmticketflow/common';
import cookieSession from 'cookie-session';
import { createChargeRouter } from './routes/new';

const app = express();

app.set('trust proxy', true);
app.use(json());
app.use(cookieSession({
  signed: false,
  secure: process.env.NODE_ENV !== 'test'
}) as any)

app.use(currentUser as any)

app.use(createChargeRouter)

app.all('*', async () => {
  throw new NotFoundError();
})

// app.all('*',async (req,res,next)=>{
//   next(new NotFoundError());
// })


app.use(errorHandler as any)

export { app };