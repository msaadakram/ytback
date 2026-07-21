import { Router } from 'express';
import {
  getPlanState,
  listInvoices,
  createCheckout,
  createPortal,
  setPlan,
} from './billing.controller.js';
import { setPlanSchema } from './billing.validator.js';
import { validate } from '../../middlewares/validate.js';
import { requireUser } from '../../middlewares/userAuth.js';

const router = Router();

router.get('/plan', requireUser, getPlanState);
router.patch('/plan', requireUser, validate(setPlanSchema), setPlan);
router.get('/invoices', requireUser, listInvoices);
router.post('/checkout', requireUser, createCheckout);
router.post('/portal', requireUser, createPortal);

export default router;
