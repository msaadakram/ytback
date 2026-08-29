import { Router } from 'express';
import { subscribeNewsletter, sendContactMessage } from './contact.controller.js';
import { newsletterSubscribeSchema, contactMessageSchema } from './contact.validator.js';
import { validate } from '../../middlewares/validate.js';
import { formLimiter } from '../../middlewares/rateLimit.js';

const router = Router();

// POST /api/newsletter/subscribe
router.post('/subscribe', formLimiter, validate(newsletterSubscribeSchema), subscribeNewsletter);

// POST /api/contact
router.post('/', formLimiter, validate(contactMessageSchema), sendContactMessage);

export default router;
