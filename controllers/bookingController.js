// controllers/bookingController.js
import asyncHandler from 'express-async-handler';
import Booking from '../models/Booking.js';
import Notification from '../models/Notification.js';
import { sendToAdmins, sendToUser } from '../utils/sseHub.js';
import { logAudit } from '../utils/audit.js';

// Map loose inputs to exact Mongoose model names used by refPath
function normalizeItemType(v) {
  const t = String(v || '').trim().toLowerCase();
  if (t === 'course' || t === 'courses') return 'Course';
  if (t === 'workshop' || t === 'workshops') return 'Workshop';
  if (t === 'product' || t === 'products') return 'Product';
  return null;
}

function toNumberOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toValidDateOrNull(v) {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

// POST /api/bookings  (Protected)
export const createBooking = asyncHandler(async (req, res) => {
  const { itemType, itemId, price, scheduledAt } = req.body;

  const normType = normalizeItemType(itemType);
  if (!normType || !itemId) {
    res.status(400);
    throw new Error('Invalid payload: itemType (Course|Workshop|Product) and itemId are required.');
  }

  const priceNum = toNumberOrNull(price);
  if (price !== undefined && priceNum === null) {
    res.status(400);
    throw new Error('Invalid price: must be a number.');
  }

  const when = toValidDateOrNull(scheduledAt);

  const booking = await Booking.create({
    user: req.user._id,
    itemType: normType,     // MUST match model names for refPath
    item: itemId,
    price: priceNum ?? 0,
    scheduledAt: when || undefined,
    status: 'pending',
    payment: { paid: false, amount: priceNum ?? 0 },
  });

  // Notify admins (DB + SSE)
  await Notification.create({
    audience: 'admin',
    type: 'new_booking',
    message: `New ${normType.toLowerCase()} booking created.`,
    link: '/admin-dashboard?tab=bookings',
    meta: { bookingId: booking._id, itemType: normType },
  });

  sendToAdmins({
    kind: 'admin_board',
    type: 'new_booking',
    message: `New ${normType.toLowerCase()} booking created.`,
    link: '/admin-dashboard?tab=bookings',
    entity: { id: booking._id.toString(), itemType: normType },
    createdAt: new Date().toISOString(),
  });

  // Return with convenient populated preview
  const populated = await Booking.findById(booking._id)
    .populate('item')
    .populate('user', 'name email');

  res.status(201).json(populated);
});

// GET /api/bookings/me  (Protected)
export const getMyBookings = asyncHandler(async (req, res) => {
  const bookings = await Booking.find({ user: req.user._id })
    .sort({ createdAt: -1 })
    .populate('item');
  res.json(bookings);
});

// GET /api/bookings  (Admin)
export const getAllBookings = asyncHandler(async (req, res) => {
  const bookings = await Booking.find()
    .sort({ createdAt: -1 })
    .populate('user', 'name email')
    .populate('item');
  res.json(bookings);
});

// PUT /api/bookings/:id/status  (Admin)
export const updateBookingStatus = asyncHandler(async (req, res) => {
  const status = req.body?.status;
  const allowed = ['pending', 'confirmed', 'cancelled', 'completed'];

  if (!status) {
    res.status(400);
    throw new Error('status is required in request body');
  }
  if (!allowed.includes(status)) {
    res.status(400);
    throw new Error(`Invalid status. Allowed: ${allowed.join(', ')}`);
  }

  const booking = await Booking.findById(req.params.id);
  if (!booking) {
    res.status(404);
    throw new Error('Booking not found');
  }

  booking.status = status;
  await booking.save();
  
  await logAudit({
    actorId: req.user._id,
    action: 'BOOKING_STATUS_CHANGED',
    entityType: 'Booking',
    entityId: b._id,
    meta: { from: prev, to: status },
    req,
  });

  // Create user notification (DB)
  await Notification.create({
    user: booking.user,
    audience: 'user',
    type: 'booking_status',
    message: `Your booking status is now "${status}".`,
    link: '/user-dashboard?tab=bookings',
    meta: { bookingId: booking._id, status },
  });

  // SSE to the booking owner
  if (booking.user) {
    sendToUser(booking.user.toString(), {
      kind: 'notification',
      type: 'booking_status',
      message: `Your booking status is now "${status}".`,
      link: '/user-dashboard?tab=bookings',
      createdAt: new Date().toISOString(),
    });
  }

  // SSE to admins for dashboard boards
  sendToAdmins({
    kind: 'admin_board',
    type: 'booking_updated',
    entity: { id: booking._id.toString(), status },
    message: 'Booking status updated',
    createdAt: new Date().toISOString(),
  });

  // Return updated w/ population for UI
  const populated = await Booking.findById(booking._id)
    .populate('user', 'name email')
    .populate('item');
  res.json(populated);
});
