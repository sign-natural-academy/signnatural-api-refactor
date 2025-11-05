// controllers/settingsController.js
import asyncHandler from 'express-async-handler';
import Settings from '../models/Settings.js';
import { uploadBufferToCloudinary, deleteFromCloudinary } from '../config/cloudinary.js';
import { logAudit } from '../utils/audit.js';

// GET /api/settings  (Admin)
export const getSettings = asyncHandler(async (req, res) => {            // 1
  const s = await Settings.getSingleton();                                // 2
  res.json(s);                                                            // 3
});

// PATCH /api/settings  (Admin)  multipart/form-data supported
export const updateSettings = asyncHandler(async (req, res) => {          // 4
  const s = await Settings.getSingleton();                                // 5

  const before = {
    siteName: s.siteName,
    contactEmail: s.contactEmail,
    contactPhone: s.contactPhone,
    logoUrl: s.logoUrl,
    privacyPolicyUrl: s.privacyPolicyUrl,
    refundPolicyUrl: s.refundPolicyUrl,
    termsUrl: s.termsUrl,
  };                                                                      // 6

  // Apply JSON fields
  const data = req.body || {};                                           // 7
  [
    'siteName', 'contactEmail', 'contactPhone', 'address',
    'privacyPolicyUrl', 'refundPolicyUrl', 'termsUrl',
    'socials.facebook', 'socials.instagram', 'socials.youtube', 'socials.tiktok',
  ].forEach((path) => {                                                  // 8
    const segs = path.split('.');
    if (segs.length === 1) {
      if (data[segs[0]] !== undefined) s[segs[0]] = data[segs[0]];
    } else {
      const [a, b] = segs;
      s[a] ??= {};
      if (data[b] !== undefined) s[a][b] = data[b];
    }
  });

  // Optional logo upload (file field: "logo")
  if (req.file?.buffer) {                                                // 9
    try {
      if (s.logoPublicId) {
        try { await deleteFromCloudinary(s.logoPublicId); } catch { /* ignore */ }
      }
      const up = await uploadBufferToCloudinary(req.file.buffer, {
        folder: 'signnatural/branding',
        transformation: [{ width: 800, crop: 'limit' }],
      });
      s.logoUrl = up.secure_url;
      s.logoPublicId = up.public_id;
    } catch (e) {
      console.error('Logo upload failed:', e?.message || e);             // 10
    }
  }

  await s.save();                                                         // 11

  try {
    await logAudit({
      actorId: req.user._id,
      action: 'SETTINGS_UPDATED',
      entityType: 'Settings',
      entityId: s._id,
      meta: { touched: Object.keys(data), hasLogo: !!req.file },
      req,
    });                                                                   // 12
  } catch (e) { console.warn('audit failed', e?.message || e); }

  res.json(s);                                                            // 13
});
