// controllers/analyticsController.js
import asyncHandler from 'express-async-handler';
import Booking from '../models/Booking.js';
import User from '../models/User.js';
import Testimonial from '../models/Testimonial.js';
import Course from '../models/Course.js';
import Workshop from '../models/Workshop.js';
import SupportTicket from '../models/SupportTicket.js';

// GET /api/analytics/overview?from=&to=
export const getOverview = asyncHandler(async (req, res) => {
  // 1) Parse date range (optional)
  const { from, to } = req.query;
  let dateFilter = {};
  if (from && to) {
    const fromD = new Date(from);
    const toD = new Date(to);
    if (!isNaN(fromD) && !isNaN(toD)) {
      toD.setHours(23, 59, 59, 999);
      dateFilter = { $gte: fromD, $lte: toD };
    }
  }

  // 2) Helpers for reuse
  const createdAtMatch = (extra = {}) =>
    Object.keys(dateFilter).length ? { ...extra, createdAt: dateFilter } : extra;

  // 3) Aggregations in parallel
  const [
    usersTotal,
    bookingsTotal,
    bookingsByStatus,
    revenueAgg,
    testimonialsPending,
    ticketsOpen,
    bookingsByDay,
    topCourses,
    topWorkshops,
  ] = await Promise.all([
    User.countDocuments(createdAtMatch()),
    Booking.countDocuments(createdAtMatch()),
    Booking.aggregate([
      { $match: createdAtMatch({}) },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Booking.aggregate([
      // Define revenue as: paid=true OR status in ['confirmed','completed'] with payment.amount
      { $match: createdAtMatch({}) },
      {
        $project: {
          amount: {
            $cond: [
              { $or: [
                { $eq: ['$payment.paid', true] },
                { $in: ['$status', ['confirmed','completed']] }
              ] },
              { $ifNull: ['$payment.amount', 0] },
              0
            ]
          }
        }
      },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    Testimonial.countDocuments({ ...createdAtMatch(), approved: false }),
    SupportTicket.countDocuments({ ...createdAtMatch(), status: { $in: ['open','in_progress'] } }),
    // Timeseries (bookings per day)
    Booking.aggregate([
      { $match: createdAtMatch({}) },
      {
        $group: {
          _id: {
            y: { $year: '$createdAt' },
            m: { $month: '$createdAt' },
            d: { $dayOfMonth: '$createdAt' },
          },
          count: { $sum: 1 },
          revenue: { $sum: { $ifNull: ['$payment.amount', 0] } },
        }
      },
      { $sort: { '_id.y': 1, '_id.m': 1, '_id.d': 1 } },
    ]),
    // Top Courses by bookings
    Booking.aggregate([
      { $match: createdAtMatch({ itemType: 'Course' }) },
      { $group: { _id: '$item', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]),
    // Top Workshops by bookings
    Booking.aggregate([
      { $match: createdAtMatch({ itemType: 'Workshop' }) },
      { $group: { _id: '$item', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]),
  ]);

  // 4) Resolve names for top items (optional, safe)
  const courseIds = topCourses.map(t => t._id).filter(Boolean);
  const workshopIds = topWorkshops.map(t => t._id).filter(Boolean);

  const [courseMap, workshopMap] = await Promise.all([
    courseIds.length
      ? Course.find({ _id: { $in: courseIds } }).select('_id title')
      : Promise.resolve([]),
    workshopIds.length
      ? Workshop.find({ _id: { $in: workshopIds } }).select('_id title')
      : Promise.resolve([]),
  ]).then(([courses, workshops]) => {
    return [
      Object.fromEntries(courses.map(c => [String(c._id), c.title])),
      Object.fromEntries(workshops.map(w => [String(w._id), w.title])),
    ];
  });

  // 5) Shape output for the UI
  const status = Object.fromEntries(bookingsByStatus.map(s => [s._id || 'unknown', s.count]));
  const revenue = revenueAgg?.[0]?.total || 0;

  const timeseries = bookingsByDay.map(p => ({
    date: `${p._id.y}-${String(p._id.m).padStart(2,'0')}-${String(p._id.d).padStart(2,'0')}`,
    bookings: p.count,
    revenue: p.revenue || 0,
  }));

  const top5Courses = topCourses.map(t => ({
    id: t._id,
    title: courseMap[String(t._id)] || 'Course',
    bookings: t.count,
  }));
  const top5Workshops = topWorkshops.map(t => ({
    id: t._id,
    title: workshopMap[String(t._id)] || 'Workshop',
    bookings: t.count,
  }));

  res.json({
    totals: {
      users: usersTotal,
      bookings: bookingsTotal,
      revenue,
      testimonialsPending,
      ticketsOpen,
    },
    bookingsByStatus: status,
    timeseries,          // array of { date, bookings, revenue }
    topCourses: top5Courses,
    topWorkshops: top5Workshops,
    range: { from: from || null, to: to || null },
  });
});
