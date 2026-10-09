import { Router, Response } from 'express';
import { notificationRepository } from '../repositories';
import { requireAuthentication, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Get current user's notifications
router.get('/', requireAuthentication, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const notifications = await notificationRepository.getUserNotifications(user.id);
  res.json({ success: true, data: notifications });
});

// Mark single notification as read
router.patch('/:id/read', requireAuthentication, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const success = await notificationRepository.markAsRead(req.params.id, user.id);
  res.json({ success });
});

// Mark all as read
router.post('/read-all', requireAuthentication, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const success = await notificationRepository.markAllAsRead(user.id);
  res.json({ success });
});

export default router;
