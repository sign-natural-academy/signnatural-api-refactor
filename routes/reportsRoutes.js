// routes/reportsRoutes.js
import express from 'express';
import { protect, requireAdminOrSuper } from '../middlewares/authMiddleware.js';
import {
  exportBookingsCsv,
  exportTestimonialsCsv,
  exportCoursesCsv,
  exportWorkshopsCsv,
} from '../controllers/reportsController.js';

const router = express.Router();

router.get('/bookings.csv', protect, requireAdminOrSuper, exportBookingsCsv);
router.get('/testimonials.csv', protect, requireAdminOrSuper, exportTestimonialsCsv);
router.get('/courses.csv', protect, requireAdminOrSuper, exportCoursesCsv);
router.get('/workshops.csv', protect, requireAdminOrSuper, exportWorkshopsCsv);

export default router;