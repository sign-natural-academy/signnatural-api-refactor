// routes/settingsRoutes.js
import express from 'express';
import multer from 'multer';
import { protect, requireAdminOrSuper } from '../middlewares/authMiddleware.js';
import { getSettings, updateSettings } from '../controllers/settingsController.js';

const router = express.Router();
const upload = multer();                                  // 1 memory storage

router.get('/', protect, requireAdminOrSuper, getSettings);                      // 2
router.patch('/', protect, requireAdminOrSuper, upload.single('logo'), updateSettings); // 3

export default router;
