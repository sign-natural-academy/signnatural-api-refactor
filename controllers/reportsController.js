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
    if (fromD && toD) {
  // normalize to full-day range
  const start = new Date(fromD);
  start.setHours(0, 0, 0, 0);

  const end = new Date(toD);
  end.setHours(23, 59, 59, 999);

  filter.createdAt = { $gte: start, $lte: end };
}

    // Populate user (name,email) and item (title/name) for human-friendly CSV
    const rawRows = await Booking.find(filter)
      .populate('user', 'name email')
      .populate('item') // we'll attempt to read title/name from item if present
      .lean();

    // normalize rows to include userName/userEmail and itemTitle
  const rows = (rawRows || []).map((r) => {
  const item = r.item || {};
  const itemTitle = item.title || item.name || item._id || '';

  const bookingMode =
    !r.user
      ? "Guest"
      : Array.isArray(r.attendees) && r.attendees.length > 0
      ? "For Others"
      : "Self";

  const attendeeEmails = Array.isArray(r.attendees)
    ? r.attendees.map(a => a.email).filter(Boolean).join("; ")
    : "";

  const attendeeCount = Array.isArray(r.attendees)
    ? r.attendees.length
    : 0;

  return {
    _id: r._id,
    userName: r.user?.name || r.contact?.name || '',
    userEmail: r.user?.email || r.contact?.email || '',
    phone: r.contact?.phone || '',
    bookingMode,
    itemTitle,
    itemType: r.itemType || '',
    price: typeof r.price === 'number' ? r.price : (r.price ?? ''),
    status: r.status || '',
    attendeeCount,
    attendeeEmails,
    createdAt: r.createdAt || '',
  };
});

const fields = [
  '_id',
  'userName',
  'userEmail',
  'phone',
  'bookingMode',
  'itemTitle',
  'itemType',
  'price',
  'status',
  'attendeeCount',
  'attendeeEmails',
  'createdAt',
];

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
    if (fromD && toD) {
  // normalize to full-day range
  const start = new Date(fromD);
  start.setHours(0, 0, 0, 0);

  const end = new Date(toD);
  end.setHours(23, 59, 59, 999);

  filter.createdAt = { $gte: start, $lte: end };
}

    const rawRows = await Testimonial.find(filter)
      .populate('user', 'name email')
      .lean();

    const rows = (rawRows || []).map((r) => {
      return {
        _id: r._id,
        userName: r.user?.name || '',
        userEmail: r.user?.email || '',
        text: r.text || r.message || '',
        rating: r.rating ?? '',
        approved: Boolean(r.approved),
        createdAt: r.createdAt || '',
      };
    });

    const fields = ['_id', 'userName', 'userEmail', 'text', 'rating', 'approved', 'createdAt'];
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
