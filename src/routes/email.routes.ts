import { Router } from 'express';
import {
  createScheduledEmail,
  getUserEmails,
  getEmailById,
  searchEmails,
  getTrashedEmails,
  softDeleteEmail,
  restoreEmail,
  permanentDeleteEmail,
  emptyTrash,
} from '../controllers/email.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router = Router();

// Protect all email endpoints so users access only their own emails
router.post('/emails', requireAuth, createScheduledEmail);
router.get('/emails', requireAuth, getUserEmails);
router.get('/emails/search', requireAuth, searchEmails);
router.get('/emails/trash', requireAuth, getTrashedEmails);
router.delete('/emails/trash', requireAuth, emptyTrash);
router.get('/emails/:id', requireAuth, getEmailById);
router.delete('/emails/:id', requireAuth, softDeleteEmail);
router.post('/emails/:id/restore', requireAuth, restoreEmail);
router.delete('/emails/:id/permanent', requireAuth, permanentDeleteEmail);

export default router;


