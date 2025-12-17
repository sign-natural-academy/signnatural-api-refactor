// routes/bookingRoutes.js
import express from 'express';
import {
  createBooking,
  getMyBookings,
  getAllBookings,
  updateBookingStatus
} from '../controllers/bookingController.js';

import { protect, requireAdmin } from '../middlewares/authMiddleware.js';
import validate from '../middlewares/validate.js';
import { createBookingSchema, updateBookingStatusSchema} from '../validators/bookingSchemas.js';
import { optionalAuth } from '../middlewares/optionalAuth.js';

const router = express.Router();

/**
 * Create a booking
 * - Authenticated users: normal booking, enforced 1-per-item
 * - Guests: allowed, must provide guestInfo
 * - Book-for-others: handled via bookingFor
 */
router.post(
  '/',
  optionalAuth,
  (req, res, next) => {
    // Pass auth state into Joi validation
    req.validationContext = {
      isGuest: !req.user
    };
    next();
  },
  validate(createBookingSchema),
  createBooking
);
// User's bookings
router.get('/me', protect, getMyBookings);

// Admin routes
router.get('/', protect, requireAdmin, getAllBookings);

router.put('/:id/status', protect, requireAdmin, validate(updateBookingStatusSchema), updateBookingStatus);

export default router;
