import { Router } from 'express';
import {
  createScheduledEmail,
  getUserEmails,
  getEmailById,
} from '../controllers/email.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router = Router();

// Protect all email endpoints so users access only their own emails
router.post('/emails', requireAuth, createScheduledEmail);
router.get('/emails', requireAuth, getUserEmails);
router.get('/emails/:id', requireAuth, getEmailById);

export default router;
