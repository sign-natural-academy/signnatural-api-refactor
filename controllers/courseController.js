
// controllers/courseController.js
import asyncHandler from 'express-async-handler';
import Course from '../models/Course.js';
import { uploadBufferToCloudinary, deleteFromCloudinary } from '../config/cloudinary.js';
import { logAudit } from '../utils/audit.js';

const createCourse = asyncHandler(async (req, res) => {
  const data = req.body || {};
  let image = data.image || null;
  let imagePublicId = data.imagePublicId || null;

  // Handle uploaded file buffer
  if (req.file && req.file.buffer) {
    try {
      const result = await uploadBufferToCloudinary(req.file.buffer, {
        folder: 'signnatural/courses',
        transformation: [{ width: 1600, crop: 'limit' }],
      });
      image = result.secure_url;
      imagePublicId = result.public_id;
    } catch (err) {
      console.error('Cloudinary upload failed (createCourse):', err.message || err);
      // Proceed without image
    }
  }

  const course = await Course.create({
    ...data,
    instructor: req.user ? req.user._id : data.instructor,
    image,
    imagePublicId,
  });

  res.status(201).json(course);
});

const getCourses = asyncHandler(async (req, res) => {
  const { q, type, page = 1, limit = 20 } = req.query;
  const filter = {};
  if (type) filter.type = type;
  if (q) filter.$or = [{ title: new RegExp(q, 'i') }, { description: new RegExp(q, 'i') }];
  const courses = await Course.find(filter).skip((page - 1) * limit).limit(parseInt(limit, 10));
  res.json(courses);
});

const getCourse = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.id);
  if (!course) {
    res.status(404);
    throw new Error('Course not found');
  }
  res.json(course);
});

const updateCourse = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.id);
  if (!course) {
    res.status(404);
    throw new Error('Course not found');
  }

  // If a new image is uploaded, upload to Cloudinary and remove previous asset
  if (req.file && req.file.buffer) {
    try {
      // delete previous image if present
      if (course.imagePublicId) {
        try { await deleteFromCloudinary(course.imagePublicId); } catch (err) { /* log and continue */ }
      }

      const result = await uploadBufferToCloudinary(req.file.buffer, {
        folder: 'signnatural/courses',
        transformation: [{ width: 1600, crop: 'limit' }],
      });
      course.image = result.secure_url;
      course.imagePublicId = result.public_id;
    } catch (err) {
      console.error('Cloudinary upload failed (updateCourse):', err.message || err);
      // continue
    }
  }

  // apply other updates from body (req.body fields already validated by Joi)
  Object.keys(req.body || {}).forEach((key) => {
    course[key] = req.body[key];
  });

  await course.save();
  await logAudit({
    actorId: req.user._id,
    action: 'Course_updated',
    entityType: 'Course',
    entityId: t._id,
    meta: { approved: true },
    req,
  });
  res.json(course);
});

const deleteCourse = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.id);
  if (!course) {
    res.status(404);
    throw new Error('Course not found');
  }

  // If there is an imagePublicId stored, try to remove the Cloudinary asset first.
  if (course.imagePublicId) {
    try {
      await deleteFromCloudinary(course.imagePublicId);
    } catch (err) {
      // Log but continue — we still delete the DB record to keep things consistent.
      console.error('Cloudinary delete failed (deleteCourse):', err.message || err);
    }
  }

  // Document-level deletion (safe and supported)
  await course.deleteOne();

  res.json({ ok: true, message: 'Course deleted' });
});

export { createCourse, getCourses, getCourse, updateCourse, deleteCourse };
