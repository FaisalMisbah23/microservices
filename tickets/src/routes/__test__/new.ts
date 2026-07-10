import { RequireAuth, validateRequest } from '@fmticketflow/common';
import express, { Request, Response } from 'express'
import { body } from 'express-validator';

const router = express.Router();

router.post('/api/tickets', RequireAuth, [
    body('title').not().isEmpty().withMessage('Title is required'),
    body('price').isFloat({gt:0}).withMessage('Price is not valid')
], validateRequest, async (req: Request, res: Response) => {
    res.sendStatus(200);
})

export { router as createTicketRouter }