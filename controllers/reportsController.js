// controllers/reportsController.js
import { Parser } from 'json2csv';
import Booking from '../models/Booking.js';
import Course from '../models/Course.js';
import Workshop from '../models/Workshop.js';
import Testimonial from '../models/Testimonial.js';

// --- Helpers ---
const safeDate = (val) => {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
};

const sendCsv = (res, filename, rows, fields) => {
  const parser = new Parser({ fields });
  const csv = parser.parse(rows || []);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.status(200).send(csv);
};

// GET /api/reports/bookings.csv?from=&to=&status=
export const exportBookingsCsv = async (req, res) => {
  try {
    const { from, to, status } = req.query;
    const filter = {};
    const fromD = safeDate(from);
    const toD = safeDate(to);

    if (status) filter.status = String(status).trim();
    if (fromD && toD) filter.createdAt = { $gte: fromD, $lte: toD };

    const rows = await Booking.find(filter)
      .select('_id name email course status createdAt')
      .lean();

    const fields = ['_id', 'name', 'email', 'course', 'status', 'createdAt'];
    sendCsv(res, 'bookings.csv', rows, fields);
  } catch (e) {
    console.error('Bookings CSV error:', e);
    res.status(500).json({ message: 'Failed to export bookings CSV' });
  }
};

// GET /api/reports/testimonials.csv?from=&to=&approved=
export const exportTestimonialsCsv = async (req, res) => {
  try {
    const { from, to, approved } = req.query;
    const filter = {};
    const fromD = safeDate(from);
    const toD = safeDate(to);

    if (approved !== undefined) {
      const norm = String(approved).toLowerCase();
      filter.approved = norm === 'true' || norm === '1';
    }
    if (fromD && toD) filter.createdAt = { $gte: fromD, $lte: toD };

    const rows = await Testimonial.find(filter)
      .select('_id name message approved createdAt')
      .lean();

    const fields = ['_id', 'name', 'message', 'approved', 'createdAt'];
    sendCsv(res, 'testimonials.csv', rows, fields);
  } catch (e) {
    console.error('Testimonials CSV error:', e);
    res.status(500).json({ message: 'Failed to export testimonials CSV' });
  }
};

// GET /api/reports/courses.csv
export const exportCoursesCsv = async (req, res) => {
  try {
    const rows = await Course.find()
      .select('_id title price category createdAt')
      .lean();

    const fields = ['_id', 'title', 'price', 'category', 'createdAt'];
    sendCsv(res, 'courses.csv', rows, fields);
  } catch (e) {
    console.error('Courses CSV error:', e);
    res.status(500).json({ message: 'Failed to export courses CSV' });
  }
};

// GET /api/reports/workshops.csv
export const exportWorkshopsCsv = async (req, res) => {
  try {
    const rows = await Workshop.find()
      .select('_id title date location price createdAt')
      .lean();

    const fields = ['_id', 'title', 'date', 'location', 'price', 'createdAt'];
    sendCsv(res, 'workshops.csv', rows, fields);
  } catch (e) {
    console.error('Workshops CSV error:', e);
    res.status(500).json({ message: 'Failed to export workshops CSV' });
  }
};
