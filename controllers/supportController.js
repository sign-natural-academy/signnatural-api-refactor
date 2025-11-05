// controllers/supportController.js
import asyncHandler from 'express-async-handler';
import SupportTicket from '../models/SupportTicket.js';
import Notification from '../models/Notification.js';
import { sendToAdmins, sendToUser } from '../utils/sseHub.js';
import { logAudit } from '../utils/audit.js';

// POST /api/support  (Protected user) - create a ticket
export const createTicket = asyncHandler(async (req, res) => {
  const { subject, category, message, priority } = req.body; // 1
  if (!subject || !message) { res.status(400); throw new Error('subject and message are required'); } // 2

  const ticket = await SupportTicket.create({ // 3
    user: req.user._id,
    subject: subject.trim(),
    category: category?.trim() || undefined,
    priority: priority || 'normal',
    status: 'open',
    messages: [{
      sender: req.user._id,
      senderRole: req.user.role,
      text: String(message).trim(),
    }],
    lastMessageAt: new Date(),
  });

  await Notification.create({ // 4
    audience: 'admin',
    type: 'support_new',
    message: `New support ticket: ${ticket.subject}`,
    link: '/admin-dashboard?tab=support',
    meta: { ticketId: ticket._id },
  });

  sendToAdmins({ // 5
    kind: 'admin_board',
    type: 'support_new',
    message: `New support ticket: ${ticket.subject}`,
    entity: { id: ticket._id },
    createdAt: new Date().toISOString(),
  });

  res.status(201).json(ticket); // 6
});

// GET /api/support/me  (Protected user) - list my tickets
export const listMyTickets = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query; // 7
  const pg = Math.max(1, parseInt(page, 10) || 1);
  const lim = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

  const [items, total] = await Promise.all([ // 8
    SupportTicket.find({ user: req.user._id })
      .sort({ lastMessageAt: -1, createdAt: -1 })
      .skip((pg - 1) * lim).limit(lim),
    SupportTicket.countDocuments({ user: req.user._id }),
  ]);

  res.json({ items, total, page: pg, pages: Math.ceil(total / lim) }); // 9
});

// GET /api/support  (Admin) - list/filter all tickets
// ?q=&status=&category=&from=&to=&page=&limit=&user=
export const listTickets = asyncHandler(async (req, res) => {
  const { q = '', status, category, from, to, user, page = 1, limit = 20 } = req.query; // 10
  const filter = {};
  if (status) filter.status = status;
  if (category) filter.category = category;
  if (user) filter.user = user;
  if (q) filter.subject = { $regex: q, $options: 'i' };
  if (from && to) {
    const fromD = new Date(from); const toD = new Date(to);
    if (!isNaN(fromD) && !isNaN(toD)) {
      toD.setHours(23, 59, 59, 999);
      filter.createdAt = { $gte: fromD, $lte: toD };
    }
  }

  const pg = Math.max(1, parseInt(page, 10) || 1);
  const lim = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

  const [items, total] = await Promise.all([
    SupportTicket.find(filter)
      .sort({ status: 1, lastMessageAt: -1 })
      .populate('user', 'name email')
      .skip((pg - 1) * lim).limit(lim),
    SupportTicket.countDocuments(filter),
  ]);

  res.json({ items, total, page: pg, pages: Math.ceil(total / lim) }); // 11
});

// PATCH /api/support/:id/status  (Admin) - change status
export const updateTicketStatus = asyncHandler(async (req, res) => {
  const { id } = req.params; // 12
  const { status } = req.body; // 'open'|'in_progress'|'resolved'|'closed'
  if (!['open', 'in_progress', 'resolved', 'closed'].includes(status)) {
    res.status(400); throw new Error('Invalid status');
  }

  const t = await SupportTicket.findById(id); // 13
  if (!t) { res.status(404); throw new Error('Ticket not found'); }

  const prev = t.status;                      // 14
  t.status = status;                          // 15
  await t.save();                              // 16

  try {                                        // 17 audit (non-blocking style)
    await logAudit({
      actorId: req.user._id,
      action: 'TICKET_STATUS_CHANGED',
      entityType: 'SupportTicket',
      entityId: t._id,
      meta: { from: prev, to: status },
      req,
    });
  } catch (e) { console.warn('audit failed', e?.message || e); }

  await Notification.create({                 // 18 notify user
    audience: 'user',
    user: t.user,
    type: 'support_update',
    message: `Your ticket status is now "${status.replace('_', ' ')}"`,
    link: '/user-dashboard?tab=support',
    meta: { ticketId: t._id, status },
  });

  sendToUser(String(t.user), {               // 19 live push
    kind: 'notification',
    type: 'support_update',
    message: `Ticket status: ${status.replace('_', ' ')}`,
    link: '/user-dashboard?tab=support',
    createdAt: new Date().toISOString(),
  });

  res.json(t);                               // 20
});

// POST /api/support/:id/reply  (Admin) - add reply
export const replyToTicket = asyncHandler(async (req, res) => {
  const { id } = req.params;                  // 21
  const { text } = req.body;
  if (!text || !String(text).trim()) { res.status(400); throw new Error('text is required'); }

  const t = await SupportTicket.findById(id); // 22
  if (!t) { res.status(404); throw new Error('Ticket not found'); }

  t.messages.push({                            // 23
    sender: req.user._id,
    senderRole: req.user.role,
    text: String(text).trim(),
  });
  t.lastMessageAt = new Date();                // 24
  if (t.status === 'open') t.status = 'in_progress'; // 25 (auto-progress)
  await t.save();                               // 26

  try {                                         // 27 audit
    await logAudit({
      actorId: req.user._id,
      action: 'TICKET_REPLIED',
      entityType: 'SupportTicket',
      entityId: t._id,
      meta: { length: String(text).trim().length },
      req,
    });
  } catch (e) { console.warn('audit failed', e?.message || e); }

  await Notification.create({                   // 28 notify user
    audience: 'user',
    user: t.user,
    type: 'support_reply',
    message: `Support replied to: ${t.subject}`,
    link: `/user-dashboard?tab=support&ticket=${t._id}`,
    meta: { ticketId: t._id },
  });

  sendToUser(String(t.user), {                  // 29 live
    kind: 'notification',
    type: 'support_reply',
    message: 'Support has replied to your ticket.',
    link: `/user-dashboard?tab=support&ticket=${t._id}`,
    createdAt: new Date().toISOString(),
  });

  res.json(t);                                  // 30
});
