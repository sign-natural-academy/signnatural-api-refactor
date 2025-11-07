// routes/notificationRoutes.js
import express from 'express';
import { protect ,requireAdminOrSuper} from '../middlewares/authMiddleware.js';
import { getMyNotifications, markRead, markAllRead ,listAdminNotifications,
  adminMarkRead,
  adminMarkAllRead,
  adminDelete, } from '../controllers/notificationController.js';

const router = express.Router();

router.get('/', protect, getMyNotifications);
router.patch('/:id/read', protect, markRead);
router.patch('/read-all', protect, markAllRead);

router.get('/', protect, getMyNotifications);
router.patch('/:id/read', protect, markRead);
router.patch('/read-all', protect, markAllRead);

/* -------------------- Admin routes -------------------- */
// GET /api/notifications/admin?type=&read=&from=&to=&page=&limit=&q=
router.get('/admin', protect, requireAdminOrSuper, listAdminNotifications);

// PATCH /api/notifications/admin/:id/read { read: boolean }
router.patch('/admin/:id/read', protect, requireAdminOrSuper, adminMarkRead);

// PATCH /api/notifications/admin/read-all  { type?, from?, to? }
router.patch('/admin/read-all', protect, requireAdminOrSuper, adminMarkAllRead);

// DELETE /api/notifications/admin/:id
router.delete('/admin/:id', protect, requireAdminOrSuper, adminDelete);

export default router;
