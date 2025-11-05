// routes/supportRoutes.js
import express from 'express';
import { protect, requireAdminOrSuper } from '../middlewares/authMiddleware.js';
import {
  createTicket,
  listMyTickets,
  listTickets,
  updateTicketStatus,
  replyToTicket,
} from '../controllers/supportController.js';

const router = express.Router();

// User
router.post('/', protect, createTicket);           // POST /api/support
router.get('/me', protect, listMyTickets);         // GET  /api/support/me

// Admin
router.get('/', protect, requireAdminOrSuper, listTickets);              // GET /api/support
router.patch('/:id/status', protect, requireAdminOrSuper, updateTicketStatus); // PATCH /api/support/:id/status
router.post('/:id/reply', protect, requireAdminOrSuper, replyToTicket);        // POST /api/support/:id/reply

export default router;
