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
import { requireVerifiedUser } from '../../middlewares/userAuth.js';

const router = Router();

router.get('/plan', requireVerifiedUser, getPlanState);
router.patch('/plan', requireVerifiedUser, validate(setPlanSchema), setPlan);
router.get('/invoices', requireVerifiedUser, listInvoices);
router.post('/checkout', requireVerifiedUser, createCheckout);
router.post('/portal', requireVerifiedUser, createPortal);

export default router;
