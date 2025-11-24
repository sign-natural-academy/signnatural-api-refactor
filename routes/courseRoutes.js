// routes/courseRoutes.js
import express from 'express';
import {
  createCourse,
  getCourses,
  getCourse,
  updateCourse,
  deleteCourse,
} from '../controllers/courseController.js';

import { protect, requireAdmin, requireAdminOrSuper } from '../middlewares/authMiddleware.js';
import validate from '../middlewares/validate.js';
import { createCourseSchema, updateCourseSchema } from '../validators/courseSchemas.js';
import { upload } from '../middlewares/uploads.js';

const router = express.Router();

router.get('/', getCourses);
router.get('/:id', getCourse);

// Admin-only operations with validation.
// Accept both image and video uploads. upload.fields runs BEFORE validate (keeps same order as before).
router.post(
  '/',
  protect,
  requireAdminOrSuper,
  upload.fields([{ name: 'image' }, { name: 'video' }]),
  validate(createCourseSchema),
  createCourse
);

router.put(
  '/:id',
  protect,
  requireAdminOrSuper,
  upload.fields([{ name: 'image' }, { name: 'video' }]),
  validate(updateCourseSchema),
  updateCourse
);

router.delete('/:id', protect, requireAdminOrSuper, deleteCourse);

export default router;
