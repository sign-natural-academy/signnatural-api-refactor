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
import { protect, requireAdmin,requireAdminOrSuper, requireSuperuser } from '../middlewares/authMiddleware.js';
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



//list users — admin & superuser
router.get('/users', protect, requireAdminOrSuper, listUsers);

// role change — superuser only
router.patch('/users/:id/role', protect, requireSuperuser, updateUserRole);

// status toggle — admin can change users; superuser can change anyone except superuser
router.patch('/users/:id/status', protect, requireAdminOrSuper, updateUserStatus);

// soft delete — same constraints as status
router.delete('/users/:id', protect, requireAdminOrSuper, softDeleteUser);

export default router;
