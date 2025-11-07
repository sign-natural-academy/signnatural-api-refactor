// routes/mediaRoutes.js
import express from 'express';
import { protect, requireAdminOrSuper } from '../middlewares/authMiddleware.js';
import { listMedia, uploadMedia, deleteMedia, upload } from '../controllers/mediaController.js';

const router = express.Router();

// List
router.get('/', protect, requireAdminOrSuper, listMedia);

// Upload (multipart)
router.post('/', protect, requireAdminOrSuper, upload.single('file'), uploadMedia);

// Delete by public_id
router.delete('/:publicId', protect, requireAdminOrSuper, deleteMedia);

export default router;
