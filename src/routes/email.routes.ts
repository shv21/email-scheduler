import { Router } from 'express';
import { createScheduledEmail } from '../controllers/email.controller';

const router = Router();

// POST /api/emails
router.post('/emails', createScheduledEmail);

export default router;
