// routes/analyticsRoutes.js
import express from 'express';
import { protect, requireAdminOrSuper } from '../middlewares/authMiddleware.js';
import { getOverview } from '../controllers/analyticsController.js';

const router = express.Router();

router.get('/overview', protect, requireAdminOrSuper, getOverview);

export default router;
