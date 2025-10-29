// routes/authRoutes.js
import express from 'express';
import {
  registerUser,
  verifyEmail,
  resendOtp,
  loginUser,
  createAdmin,
  getMe,
  listUsers, updateUserRole, updateUserStatus, softDeleteUser,
} from '../controllers/authController.js';

import otpLimiter  from '../middlewares/otpLimiter.js';
import { protect, requireAdmin } from '../middlewares/authMiddleware.js';
import validate from '../middlewares/validate.js';
import {
  registerSchema,
  verifyEmailSchema,
  resendOtpSchema,
  loginSchema,
  createAdminSchema
} from '../validators/authSchemas.js';  // <-- plural here

import { googleSignIn } from '../controllers/authController.js';
import { googleLoginSchema } from '../validators/authSchemas.js';

const router = express.Router();

// Public
router.post('/register', validate(registerSchema), registerUser);
router.post('/verify-email', validate(verifyEmailSchema), verifyEmail);
router.post('/resend-otp', otpLimiter, validate(resendOtpSchema), resendOtp);
router.post('/login', validate(loginSchema), loginUser);
router.post('/google', validate(googleLoginSchema), googleSignIn);


// Protected
router.get('/me', protect, getMe);

// Admin-only: create another admin
router.post('/admin', protect, requireAdmin, validate(createAdminSchema), createAdmin);

// Admin user management
router.get('/users', protect, requireAdmin, listUsers);
router.patch('/users/:id/role', protect, requireAdmin, updateUserRole);
router.patch('/users/:id/status', protect, requireAdmin, updateUserStatus);
router.delete('/users/:id', protect, requireAdmin, softDeleteUser);

export default router;
