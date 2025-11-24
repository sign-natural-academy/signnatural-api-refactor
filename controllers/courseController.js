// controllers/courseController.js
import asyncHandler from 'express-async-handler';
import Course from '../models/Course.js';
import { uploadBufferToCloudinary, deleteFromCloudinary } from '../config/cloudinary.js';
import { logAudit } from '../utils/audit.js';

const MAX_VIDEO_BYTES = 10 * 1024 * 1024; // 10 MB

const createCourse = asyncHandler(async (req, res) => {
  const data = req.body || {};
  let image = data.image || null;
  let imagePublicId = data.imagePublicId || null;

  // Handle uploaded image (unchanged)
  if (req.file && req.file.fieldname === 'image' && req.file.buffer) {
    try {
      const result = await uploadBufferToCloudinary(req.file.buffer, {
        folder: 'signnatural/courses',
        transformation: [{ width: 1600, crop: 'limit' }],
      });
      image = result.secure_url;
      imagePublicId = result.public_id;
    } catch (err) {
      console.error('Cloudinary upload failed (createCourse image):', err.message || err);
      // Proceed without image
    }
  }

  // Video handling (new)
  let videoUrl = data.videoUrl || null;
  let videoType = null;
  let videoPublicId = data.videoPublicId || null;
  let videoSize = data.videoSize ? Number(data.videoSize) : null;

  // If client provided a YouTube link
  if (data.videoUrl && String(data.videoUrl).trim()) {
    videoType = 'youtube';
    videoUrl = String(data.videoUrl).trim();
    // make sure we don't preserve videoPublicId in this case
    videoPublicId = null;
    videoSize = null;
  }

  // If a file upload was sent with fieldname 'video' use that
  if (req.file && req.file.fieldname === 'video' && req.file.buffer) {
    // enforce size limit
    const size = req.file.buffer.length;
    if (size > MAX_VIDEO_BYTES) {
      res.status(400);
      throw new Error('Uploaded video exceeds 10 MB limit.');
    }

    try {
      const result = await uploadBufferToCloudinary(req.file.buffer, {
        folder: 'signnatural/courses/videos',
        resource_type: 'video',
        // no special transformation required — you can add quality/format as needed
      });
      videoUrl = result.secure_url;
      videoPublicId = result.public_id;
      videoType = 'upload';
      videoSize = size;
    } catch (err) {
      console.error('Cloudinary video upload failed (createCourse):', err.message || err);
      // Proceed without video (so course can still be created)
    }
  }

  const course = await Course.create({
    ...data,
    instructor: req.user ? req.user._id : data.instructor,
    image,
    imagePublicId,
    videoUrl,
    videoType,
    videoPublicId,
    videoSize,
  });

  // AUDIT (non-blocking): course created
  try {
    await logAudit({
      actorId: req.user._id,
      action: 'COURSE_CREATED',
      entityType: 'Course',
      entityId: course._id,
      meta: { title: course.title, price: course.price, category: course.category, videoType: course.videoType ? course.videoType : null },
      req,
    });
  } catch (e) {
    console.warn('audit log failed (COURSE_CREATED):', e?.message || e);
  }

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

  // snapshot BEFORE changes for audit
  const before = {
    title: course.title,
    price: course.price,
    duration: course.duration,
    category: course.category,
    type: course.type,
    image: course.image,
    imagePublicId: course.imagePublicId,
    videoUrl: course.videoUrl,
    videoType: course.videoType,
    videoPublicId: course.videoPublicId,
    videoSize: course.videoSize,
  };

  // If a new image is uploaded, upload to Cloudinary and remove previous asset
  if (req.file && req.file.fieldname === 'image' && req.file.buffer) {
    try {
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
      console.error('Cloudinary upload failed (updateCourse image):', err.message || err);
      // continue
    }
  }

  // Video updates:
  // 1) If body contains videoUrl (YouTube), use it and clear any previous uploaded video asset.
  if (req.body && req.body.videoUrl) {
    // if switching from an uploaded video, try to delete previous uploaded asset
    if (course.videoPublicId) {
      try { await deleteFromCloudinary(course.videoPublicId); } catch (e) { /* continue */ }
    }
    course.videoUrl = String(req.body.videoUrl).trim();
    course.videoType = course.videoUrl ? 'youtube' : null;
    course.videoPublicId = null;
    course.videoSize = null;
  }

  // 2) If a file is uploaded with fieldname 'video', treat it as an uploaded video
  if (req.file && req.file.fieldname === 'video' && req.file.buffer) {
    const size = req.file.buffer.length;
    if (size > MAX_VIDEO_BYTES) {
      res.status(400);
      throw new Error('Uploaded video exceeds 10 MB limit.');
    }

    try {
      // delete previous uploaded video if any
      if (course.videoPublicId) {
        try { await deleteFromCloudinary(course.videoPublicId); } catch (err) { /* continue */ }
      }

      const result = await uploadBufferToCloudinary(req.file.buffer, {
        folder: 'signnatural/courses/videos',
        resource_type: 'video',
      });
      course.videoUrl = result.secure_url;
      course.videoPublicId = result.public_id;
      course.videoType = 'upload';
      course.videoSize = size;
    } catch (err) {
      console.error('Cloudinary video upload failed (updateCourse):', err.message || err);
      // continue
    }
  }

  // apply other updates from body (req.body fields already validated by Joi)
  Object.keys(req.body || {}).forEach((key) => {
    // Prevent clobbering video fields unintentionally (we handled videoUrl above)
    if (['videoPublicId', 'videoType', 'videoSize'].includes(key)) return;
    if (key === 'imagePublicId') return; // imagePublicId handled by upload logic
    course[key] = req.body[key];
  });

  await course.save();

  // AUDIT (non-blocking): course updated
  const after = {
    title: course.title,
    price: course.price,
    duration: course.duration,
    category: course.category,
    type: course.type,
    image: course.image,
    imagePublicId: course.imagePublicId,
    videoUrl: course.videoUrl,
    videoType: course.videoType,
    videoPublicId: course.videoPublicId,
    videoSize: course.videoSize,
  };

  try {
    await logAudit({
      actorId: req.user._id,
      action: 'COURSE_UPDATED',
      entityType: 'Course',
      entityId: course._id,
      meta: { before, after },
      req,
    });
  } catch (e) {
    console.warn('audit log failed (COURSE_UPDATED):', e?.message || e);
  }

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
      console.error('Cloudinary delete failed (deleteCourse image):', err.message || err);
    }
  }

  // Also try to delete uploaded video asset if present
  if (course.videoPublicId) {
    try {
      await deleteFromCloudinary(course.videoPublicId);
    } catch (err) {
      console.error('Cloudinary delete failed (deleteCourse video):', err.message || err);
    }
  }

  // Document-level deletion (safe and supported)
  await course.deleteOne();

  // AUDIT (non-blocking): course deleted
  try {
    await logAudit({
      actorId: req.user._id,
      action: 'COURSE_DELETED',
      entityType: 'Course',
      entityId: course._id,
      meta: { title: course.title },
      req,
    });
  } catch (e) {
    console.warn('audit log failed (COURSE_DELETED):', e?.message || e);
  }

  res.json({ ok: true, message: 'Course deleted' });
});

export { createCourse, getCourses, getCourse, updateCourse, deleteCourse };
