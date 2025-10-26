// controllers/testimonialController.js
import asyncHandler from 'express-async-handler';
import Testimonial from '../models/Testimonial.js';
import { uploadBufferToCloudinary, deleteFromCloudinary } from '../config/cloudinary.js';
import Notification from '../models/Notification.js';
import { sendToUser, sendToAdmins } from '../utils/sseHub.js';

/** Helper: normalize rating to 1..5 (default 5) */
function toRating(val) {
  const n = Number(val);
  if (!Number.isFinite(n)) return 5;
  return Math.min(5, Math.max(1, Math.round(n)));
}

/**
 * POST /api/testimonials
 * Protected (user) - create testimonial (image optional)
 */
export const createTestimonial = asyncHandler(async (req, res) => {
  const { text, tag, rating } = req.body; // <-- rating was missing before
  if (!text || text.trim().length === 0) {
    res.status(400);
    throw new Error('Text is required');
  }

  let imageUrl = null;
  let imagePublicId = null;

  if (req.file?.buffer) {
    const options = {
      folder: 'signnatural/testimonials',
      transformation: [{ width: 1200, crop: 'limit' }],
    };
    const result = await uploadBufferToCloudinary(req.file.buffer, options);
    imageUrl = result.secure_url;
    imagePublicId = result.public_id;
  }

  const doc = await Testimonial.create({
    user: req.user ? req.user._id : null,
    text: text.trim(),
    tag: tag || null,
    imageUrl,
    imagePublicId,
    rating: toRating(rating), // <-- clamp to 1..5
    approved: false, // admin must approve
  });

  // Notify admins (SSE)
  sendToAdmins({
    kind: 'admin_board',
    type: 'testimonial_pending_created',
    message: 'New story submitted and is pending approval.',
    entity: { id: doc._id },
    createdAt: new Date().toISOString(),
  });

  res.status(201).json(doc);
});

/**
 * GET /api/testimonials/approved
 * Public - list approved testimonials
 */
export const getApprovedTestimonials = asyncHandler(async (req, res) => {
  const docs = await Testimonial
    .find({ approved: true })
    .populate('user', 'name') // return the user's name
    .sort({ createdAt: -1 })
    .limit(50);
  res.json(docs);
});

/**
 * GET /api/testimonials/pending
 * Admin - list pending testimonials
 */
export const getPendingTestimonials = asyncHandler(async (req, res) => {
  const docs = await Testimonial
    .find({ approved: false })
    .sort({ createdAt: -1 });
  res.json(docs);
});

/**
 * POST /api/testimonials/:id/approve
 * Admin - approve a testimonial
 */
export const approveTestimonial = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const doc = await Testimonial.findById(id);
  if (!doc) {
    res.status(404);
    throw new Error('Testimonial not found');
  }

  doc.approved = true;
  await doc.save();

  // Create user notification (DB)
  if (doc.user) {
    await Notification.create({
      user: doc.user,
      audience: 'user',
      type: 'story_approved',
      message: 'Your story has been approved and is now visible on Success Stories.',
      link: '/stories',
      meta: { testimonialId: doc._id },
    });
  }

  // SSE pushes
  sendToAdmins({
    kind: 'admin_board',
    type: 'testimonial_approved',
    entity: { id: doc._id },
    message: 'A story was approved.',
    createdAt: new Date().toISOString(),
  });

  if (doc.user) {
    sendToUser(doc.user.toString(), {
      kind: 'notification',
      type: 'story_approved',
      message: 'Your story has been approved!',
      link: '/stories',
      createdAt: new Date().toISOString(),
    });
  }

  res.json(doc);
});

/**
 * DELETE /api/testimonials/:id
 * Admin - delete testimonial and remove cloudinary asset if present
 */
export const deleteTestimonial = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const doc = await Testimonial.findById(id);
  if (!doc) {
    res.status(404);
    throw new Error('Testimonial not found');
  }

  if (doc.imagePublicId) {
    try {
      await deleteFromCloudinary(doc.imagePublicId);
    } catch (err) {
      console.error('Cloudinary delete failed:', err?.message || err);
      // continue with DB delete
    }
  }

  await Testimonial.deleteOne({ _id: doc._id }); // Mongoose 7+ preferred over doc.remove()

  sendToAdmins({
    kind: 'admin_board',
    type: 'testimonial_deleted',
    entity: { id: doc._id },
    message: 'A story was deleted.',
    createdAt: new Date().toISOString(),
  });

  res.json({ message: 'Testimonial deleted' });
});

/**
 * GET /api/testimonials/mine
 * Protected - current user's testimonials
 */
export const getMyTestimonials = asyncHandler(async (req, res) => {
  const docs = await Testimonial
    .find({ user: req.user._id })
    .sort({ createdAt: -1 });
  res.json(docs);
});
