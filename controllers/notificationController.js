// controllers/notificationController.js
import asyncHandler from 'express-async-handler';
import Notification from '../models/Notification.js';


// GET /api/notifications (current user, unread first)
export const getMyNotifications = asyncHandler(async (req, res) => {
  const list = await Notification.find({
    $or: [{ user: req.user._id }, { audience: 'all' }, { audience: req.user.role === 'admin' ? 'admin' : '__none__' }]
  })
  .sort({ read: 1, createdAt: -1 })
  .limit(100);

  res.json(list);
});

// PATCH /api/notifications/:id/read
export const markRead = asyncHandler(async (req, res) => {
  const n = await Notification.findOne({ _id: req.params.id, $or: [{ user: req.user._id }, { audience: 'all' }] });
  if (!n) {
    res.status(404);
    throw new Error('Notification not found');
  }
  n.read = true;
  await n.save();
  res.json({ ok: true });
});

// PATCH /api/notifications/read-all
export const markAllRead = asyncHandler(async (req, res) => {
  await Notification.updateMany(
    { $or: [{ user: req.user._id }, { audience: 'all' }, { audience: req.user.role === 'admin' ? 'admin' : '__none__' }] },
    { $set: { read: true } }
  );
  res.json({ ok: true });
});

export const listAdminNotifications = asyncHandler(async (req, res) => {            // 1
  const {
    type, read, from, to, q = '',
    page = 1, limit = 20,
  } = req.query;

  const pg  = Math.max(1, parseInt(page, 10) || 1);                                 // 2
  const lim = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

  const filter = { audience: 'admin' };                                             // 3
  if (type) filter.type = type;
  if (read === 'true') filter.read = true;
  if (read === 'false') filter.read = false;

  if (from && to) {                                                                  // 4
    const f = new Date(from);
    const t = new Date(to); t.setHours(23, 59, 59, 999);
    if (!isNaN(f) && !isNaN(t)) filter.createdAt = { $gte: f, $lte: t };
  }

  if (q.trim()) {                                                                    // 5
    const rx = new RegExp(q.trim(), 'i');
    filter.$or = [{ message: rx }, { link: rx }, { type: rx }];
  }

  const [items, total] = await Promise.all([                                         // 6
    Notification.find(filter).sort({ createdAt: -1 }).skip((pg - 1) * lim).limit(lim),
    Notification.countDocuments(filter),
  ]);

  res.json({ items, total, page: pg, limit: lim, pages: Math.ceil(total / lim) });   // 7
});

/**
 * PATCH /api/notifications/admin/:id/read  { read: boolean }
 * Admin/Super: toggle read for admin-audience notifications
 */
export const adminMarkRead = asyncHandler(async (req, res) => {                      // 8
  const { id } = req.params;
  const { read = true } = req.body || {};
  const doc = await Notification.findOne({ _id: id, audience: 'admin' });
  if (!doc) { res.status(404); throw new Error('Notification not found'); }
  doc.read = !!read;
  await doc.save();
  res.json(doc);
});

/**
 * PATCH /api/notifications/admin/read-all  { type?, from?, to? }
 * Admin/Super: bulk mark as read for admin-audience notifications
 */
export const adminMarkAllRead = asyncHandler(async (req, res) => {                   // 9
  const { type, from, to } = req.body || {};
  const filter = { audience: 'admin', read: { $ne: true } };
  if (type) filter.type = type;
  if (from && to) {
    const f = new Date(from);
    const t = new Date(to); t.setHours(23, 59, 59, 999);
    if (!isNaN(f) && !isNaN(t)) filter.createdAt = { $gte: f, $lte: t };
  }
  const result = await Notification.updateMany(filter, { $set: { read: true } });
  res.json({
    ok: true,
    matched: result.matchedCount ?? result.n,
    modified: result.modifiedCount ?? result.nModified
  });
});

/**
 * DELETE /api/notifications/admin/:id
 * Admin/Super: delete an admin-audience notification
 */
export const adminDelete = asyncHandler(async (req, res) => {                        // 10
  const { id } = req.params;
  const doc = await Notification.findOne({ _id: id, audience: 'admin' });
  if (!doc) { res.status(404); throw new Error('Notification not found'); }
  await Notification.deleteOne({ _id: id });
  res.json({ ok: true });
});