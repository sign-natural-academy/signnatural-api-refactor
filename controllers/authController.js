// controllers/authController.js
import asyncHandler from 'express-async-handler';
import bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';

import Otp from '../models/Otp.js';
import User from '../models/User.js';
import generateToken from '../utils/generateToken.js';
import { sendOtpEmail } from '../utils/email.js';
import { sendToAdmins } from '../utils/sseHub.js';
import { logAudit } from '../utils/audit.js';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const OTP_EXPIRES_MIN = Number(process.env.OTP_EXPIRES_MINUTES) || 10;

/* ---------------------------- Helpers ---------------------------- */

async function createAndSendOtp(user) {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const hash = await bcrypt.hash(otp, 10);
  const expiresAt = new Date(Date.now() + OTP_EXPIRES_MIN * 60 * 1000);

  await Otp.deleteMany({ user: user._id, purpose: 'email_verification' });
  await Otp.create({
    user: user._id,
    codeHash: hash,
    purpose: 'email_verification',
    expiresAt,
  });

  await sendOtpEmail(user.email, otp, user.name);
}

/* --------------------------- Auth: Local -------------------------- */

// POST /api/auth/register
export const registerUser = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    res.status(400);
    throw new Error('name, email and password are required');
  }

  const exists = await User.findOne({ email });
  if (exists) {
    res.status(400);
    throw new Error('Email already registered');
  }

  const user = await User.create({
    name,
    email,
    password,
    role: 'user',
    emailVerified: false,
    isActive: true,
  });

  try {
    await createAndSendOtp(user);
    res.status(201).json({ message: 'User registered. OTP sent to email.' });
  } catch (e) {
    console.error('OTP email send failed after registration:', e?.message || e);
    res
      .status(201)
      .json({ message: 'User registered. OTP could not be sent right now—use "Resend code".' });
  }
});

// POST /api/auth/verify-email
export const verifyEmail = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    res.status(400);
    throw new Error('email and otp required');
  }

  const user = await User.findOne({ email });
  if (!user) { res.status(400); throw new Error('Invalid email'); }

  const otpDoc = await Otp.findOne({ user: user._id, purpose: 'email_verification' });
  if (!otpDoc) { res.status(400); throw new Error('No OTP found or it expired'); }

  const isMatch = await bcrypt.compare(otp, otpDoc.codeHash);
  if (!isMatch) { res.status(400); throw new Error('Invalid OTP'); }

  user.emailVerified = true;
  await user.save();
  await Otp.deleteMany({ user: user._id, purpose: 'email_verification' });

  const token = generateToken(user._id, user.role);
  res.json({
    token,
    user: { _id: user._id, name: user.name, email: user.email, role: user.role, emailVerified: true },
  });
});

// POST /api/auth/resend-otp
export const resendOtp = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) { res.status(400); throw new Error('email required'); }

  const user = await User.findOne({ email });
  if (!user) { res.status(400); throw new Error('Invalid email'); }
  if (user.emailVerified) { res.status(400); throw new Error('Email already verified'); }

  await createAndSendOtp(user);
  res.json({ message: 'OTP resent to email.' });
});

// POST /api/auth/login
export const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) { res.status(400); throw new Error('email and password required'); }

  const user = await User.findOne({ email });
  if (!user) { res.status(401); throw new Error('Invalid credentials'); }

  if (!user.emailVerified) { res.status(403); throw new Error('Email not verified'); }
  if (!user.isActive) { res.status(403); throw new Error('Account disabled. Contact support.'); }

  const isMatch = await user.matchPassword(password);
  if (!isMatch) { res.status(401); throw new Error('Invalid credentials'); }

  const token = generateToken(user._id, user.role);
  res.json({
    token,
    user: { _id: user._id, name: user.name, email: user.email, role: user.role, emailVerified: user.emailVerified },
  });
});

// POST /api/auth/create-admin  (protected + admin)
export const createAdmin = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) { res.status(400); throw new Error('name, email and password required'); }

  const exists = await User.findOne({ email });
  if (exists) { res.status(400); throw new Error('Email already registered'); }

  const admin = await User.create({
    name,
    email,
    password,
    role: 'admin',
    emailVerified: true,
    isActive: true,
  });

  res
    .status(201)
    .json({ _id: admin._id, name: admin.name, email: admin.email, role: admin.role });
});

// GET /api/auth/me  (protected)
export const getMe = asyncHandler(async (req, res) => {
  const u = await User.findById(req.user._id).select('-password');
  res.json(u);
});

/* ------------------------ Auth: Google Sign-In ------------------------ */

// POST /api/auth/google
export const googleSignIn = asyncHandler(async (req, res) => {
  const { credential } = req.body;
  if (!credential) {
    res.status(400);
    throw new Error('Missing Google credential');
  }

  let ticket;
  try {
    ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
  } catch (e) {
    res.status(401);
    throw new Error('Invalid Google token');
  }

  const payload = ticket.getPayload();
  const { email, name, picture, email_verified, sub } = payload || {};

  if (!email || !email_verified) {
    res.status(400);
    throw new Error('Google account email not verified');
  }

  let user = await User.findOne({ email });

  if (!user) {
    const randomPwd = await bcrypt.hash(sub + Date.now().toString(), 10);
    user = await User.create({
      name: name || email.split('@')[0],
      email,
      password: randomPwd,
      role: 'user',
      emailVerified: true,
      isActive: true,
      avatar: picture || undefined,
      provider: 'google',
      googleId: sub,
    });
  } else {
    if (!user.emailVerified) user.emailVerified = true;
    if (picture && !user.avatar) user.avatar = picture;
    if (name && !user.name) user.name = name;
    if (user.isActive === false) { res.status(403); throw new Error('Account disabled. Contact support.'); }
    await user.save();
  }

  const token = generateToken(user._id, user.role);
  res.json({
    token,
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      emailVerified: user.emailVerified,
      avatar: user.avatar || null,
    },
  });
});

/* ---------------------- Admin: User Management ---------------------- */

// GET /api/auth/users?search=&role=&page=&limit=
export const listUsers = asyncHandler(async (req, res) => {
  const { search = '', role, page = 1, limit = 50 } = req.query;

  const q = {};
  if (search) {
    q.$or = [
      { name:  { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];
  }
  if (role && ['user', 'admin'].includes(role)) q.role = role;

  const pg  = Math.max(1, parseInt(page, 10) || 1);
  const lim = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));

  const [items, total] = await Promise.all([
    User.find(q).sort({ createdAt: -1 }).skip((pg - 1) * lim).limit(lim).select('-password'),
    User.countDocuments(q),
  ]);

  res.json({ items, total, page: pg, limit: lim });
});


// PATCH /api/auth/users/:id/role
export const updateUserRole = asyncHandler(async (req, res) => {
  if (req.user.role !== 'superuser') {
    res.status(403); throw new Error('Only superuser can change roles');
  }

  const { id } = req.params;
  const { role } = req.body; // 'user' | 'admin' | 'superuser' (limited by your policy)

  const target = await User.findById(id);
  if (!target) { res.status(404); throw new Error('User not found'); }

  if (String(target._id) === String(req.user._id)) {
    res.status(400); throw new Error('Cannot change your own role');
  }
  if (target.role === 'superuser') {
    res.status(403); throw new Error('Cannot change a superuser role');
  }

  const prev = target.role;          // AUDIT+
  target.role = role;
  await target.save();

  // AUDIT+: user role changed
  await logAudit({
    actorId: req.user._id,
    action: 'USER_ROLE_CHANGED',
    entityType: 'User',
    entityId: target._id,
    meta: { from: prev, to: role },
    req,
  });

  sendToAdmins?.({
    kind: 'admin_board',
    type: 'user_updated',
    message: `Role changed to ${role}`,
    entity: { id: target._id, role },
    createdAt: new Date().toISOString(),
  });

  res.json({ _id: target._id, role: target.role });
});

// PATCH /api/auth/users/:id/status
export const updateUserStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { isActive } = req.body;

  const target = await User.findById(id);
  if (!target) { res.status(404); throw new Error('User not found'); }

  if (String(target._id) === String(req.user._id)) {
    res.status(400); throw new Error('Cannot change your own status');
  }

  if (req.user.role === 'admin') {
    if (target.role !== 'user') {
      res.status(403); throw new Error('Admins can only change status of users');
    }
  } else if (req.user.role === 'superuser') {
    if (target.role === 'superuser') {
      res.status(403); throw new Error('Cannot change status of a superuser');
    }
  } else {
    res.status(403); throw new Error('Forbidden');
  }

  const prev = !!target.isActive;    // AUDIT+
  target.isActive = !!isActive;
  await target.save();

  // AUDIT+: user status changed
  await logAudit({
    actorId: req.user._id,
    action: 'USER_STATUS_CHANGED',
    entityType: 'User',
    entityId: target._id,
    meta: { from: prev, to: target.isActive },
    req,
  });

  sendToAdmins?.({
    kind: 'admin_board',
    type: 'user_updated',
    message: `Status changed to ${target.isActive ? 'enabled' : 'disabled'}`,
    entity: { id: target._id, isActive: target.isActive },
    createdAt: new Date().toISOString(),
  });

  res.json({ _id: target._id, isActive: target.isActive });
});
// DELETE /api/auth/users/:id  (soft delete -> isActive=false)
export const softDeleteUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const target = await User.findById(id);
  if (!target) { res.status(404); throw new Error('User not found'); }

  if (String(target._id) === String(req.user._id)) {
    res.status(400); throw new Error('Cannot delete yourself');
  }

  if (req.user.role === 'admin') {
    if (target.role !== 'user') {
      res.status(403); throw new Error('Admins can only delete users');
    }
  } else if (req.user.role === 'superuser') {
    if (target.role === 'superuser') {
      res.status(403); throw new Error('Cannot delete a superuser');
    }
  } else {
    res.status(403); throw new Error('Forbidden');
  }

  const prev = !!target.isActive;    // AUDIT+
  target.isActive = false;
  await target.save();

  // AUDIT+: soft delete captured as status change
  await logAudit({
    actorId: req.user._id,
    action: 'USER_STATUS_CHANGED',    // or 'USER_SOFT_DELETED' if you prefer a distinct action
    entityType: 'User',
    entityId: target._id,
    meta: { from: prev, to: false, reason: 'soft_delete' },
    req,
  });

  sendToAdmins?.({
    kind: 'admin_board',
    type: 'user_updated',
    message: 'User soft-deleted',
    entity: { id: target._id, isActive: false },
    createdAt: new Date().toISOString(),
  });

  res.json({ _id: target._id, isActive: target.isActive });
});