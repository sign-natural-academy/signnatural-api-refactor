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
// POST /api/bookings (Auth OPTIONAL)
export const createBooking = asyncHandler(async (req, res) => {
  const {
    itemType,
    itemId,
    price,
    scheduledAt,
    contact,
    attendees = [],
  } = req.body;

  const normType = normalizeItemType(itemType);
  if (!normType || !itemId) {
    res.status(400);
    throw new Error(
      "Invalid payload: itemType (Course|Workshop|Product) and itemId are required."
    );
  }

  /**
   * CONTACT RESOLUTION (CRITICAL FIX)
   * Logged-in user → override contact from profile
   * Guest → must provide contact
   */
  let finalContact;

  if (req.user) {
    finalContact = {
      name: req.user.name,
      email: req.user.email.toLowerCase(),
    };
  } else {
    if (!contact?.name || !contact?.email) {
      res.status(400);
      throw new Error("Contact name and email are required for guest booking.");
    }
    finalContact = {
      name: contact.name.trim(),
      email: contact.email.toLowerCase(),
      phone: contact.phone,
    };
  }

  const priceNum = toNumberOrNull(price);
  if (price !== undefined && priceNum === null) {
    res.status(400);
    throw new Error("Invalid price: must be a number.");
  }

  const when = toValidDateOrNull(scheduledAt);

  /**
   * DUPLICATE PROTECTION
   * - by user (if logged in)
   * - OR by contact email
   */
  const duplicateQuery = {
    itemType: normType,
    item: itemId,
    status: { $in: ["pending", "confirmed"] },
    $or: [],
  };

  if (req.user?._id) {
    duplicateQuery.$or.push({ user: req.user._id });
  }

  duplicateQuery.$or.push({ "contact.email": finalContact.email });

  const existing = await Booking.findOne(duplicateQuery);
  if (existing) {
    res.status(409);
    throw new Error(
      "An active booking already exists for this item with this email."
    );
  }

  const booking = await Booking.create({
    user: req.user?._id || null,
    contact: finalContact,
    attendees,
    itemType: normType,
    item: itemId,
    price: priceNum ?? 0,
    scheduledAt: when || undefined,
    status: "pending",
    payment: {
      paid: false,
      amount: priceNum ?? 0,
    },
  });

  // Admin notification (unchanged)
  await Notification.create({
    audience: "admin",
    type: "new_booking",
    message: `New ${normType.toLowerCase()} booking created.`,
    link: "/admin-dashboard?tab=bookings",
    meta: { bookingId: booking._id, itemType: normType },
  });

  sendToAdmins({
    kind: "admin_board",
    type: "new_booking",
    message: `New ${normType.toLowerCase()} booking created.`,
    link: "/admin-dashboard?tab=bookings",
    entity: { id: booking._id.toString(), itemType: normType },
    createdAt: new Date().toISOString(),
  });

  const populated = await Booking.findById(booking._id)
    .populate("item")
    .populate("user", "name email");

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
  const prev = booking.status
  booking.status = status;
  await booking.save();

 // AUDIT (non-blocking)
  try {
    await logAudit({
      actorId: req.user._id,
      action: 'BOOKING_STATUS_CHANGED',
      entityType: 'Booking',
      entityId: booking._id,
      meta: { from: prev, to: status },
      req,
    });
  } catch (e) {
    console.warn('audit log failed (BOOKING_STATUS_CHANGED):', e?.message || e);
  }

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
