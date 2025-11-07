// controllers/mediaController.js
import asyncHandler from 'express-async-handler';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { uploadBufferToCloudinary, deleteFromCloudinary } from '../config/cloudinary.js';

// Optional “in-use” cross-checks (best-effort; don’t crash if models missing)
import Course from '../models/Course.js';
import Workshop from '../models/Workshop.js';
import Product from '../models/Product.js';
import Testimonial from '../models/Testimonial.js';
// Settings may hold logo
import Settings from '../models/Settings.js';

export const upload = multer({ storage: multer.memoryStorage() }); // handles req.file.buffer

// GET /api/media?folder=&q=&page=&limit=
export const listMedia = asyncHandler(async (req, res) => {
  const { folder = 'signnatural', q = '', page = 1, limit = 24 } = req.query;

  // Cloudinary Search API (server-side only)
  // Expression doc: https://cloudinary.com/documentation/search_api
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const perPage = Math.min(100, Math.max(1, parseInt(limit, 10) || 24));

  // Build expression: folder + optional fulltext in filename/public_id
  const parts = [`folder:${folder}/*`];
  if (q.trim()) {
    // Search in filename or public_id
    parts.push(`(filename:${q} OR public_id:${q})`);
  }
  const expression = parts.join(' AND ');

  const result = await cloudinary.search
    .expression(expression)
    .sort_by('created_at', 'desc')
    .max_results(perPage)
    .next_cursor(pageNum > 1 ? undefined : undefined) // we’ll implement simple page by “skip” via API search below
    .execute();

  // Cloudinary search is cursor-based. For simplicity, we just return first page.
  // For real pagination, you would pass/receive `next_cursor` and the client would keep it.
  res.json({
    items: (result.resources || []).map(r => ({
      public_id: r.public_id,
      format: r.format,
      secure_url: r.secure_url,
      bytes: r.bytes,
      width: r.width,
      height: r.height,
      created_at: r.created_at,
      folder: r.folder,
      resource_type: r.resource_type,
    })),
    total: result.total_count ?? (result.resources?.length || 0),
    page: pageNum,
    limit: perPage,
    // Optional: expose cursor for advanced pagination
    next_cursor: result.next_cursor || null,
  });
});

// POST /api/media (multipart/form-data, field: file) -> body: { folder?: string }
export const uploadMedia = asyncHandler(async (req, res) => {
  if (!req.file?.buffer) {
    res.status(400);
    throw new Error('Missing file');
  }
  const { folder = 'signnatural/misc' } = req.body || {};

  const up = await uploadBufferToCloudinary(req.file.buffer, {
    folder,
    transformation: [{ width: 2000, crop: 'limit' }],
  });

  res.status(201).json({
    public_id: up.public_id,
    secure_url: up.secure_url,
    width: up.width,
    height: up.height,
    bytes: up.bytes,
    folder: up.folder,
    created_at: up.created_at,
  });
});

// Utility: best-effort “in-use” check by public_id
async function isAssetInUse(publicId) {
  const checks = await Promise.allSettled([
    Course.exists({ imagePublicId: publicId }),
    Workshop.exists({ imagePublicId: publicId }),
    Product.exists({ imagePublicId: publicId }),
    Testimonial.exists({ imagePublicId: publicId }),
    Settings.exists({ logoPublicId: publicId }),
  ]);
  return checks.some(r => r.status === 'fulfilled' && r.value);
}

// DELETE /api/media/:publicId?force=false
export const deleteMedia = asyncHandler(async (req, res) => {
  const { publicId } = req.params;
  const force = String(req.query.force || 'false') === 'true';

  if (!publicId) {
    res.status(400);
    throw new Error('publicId is required');
  }

  if (!force) {
    const inUse = await isAssetInUse(publicId);
    if (inUse) {
      res.status(409);
      throw new Error('Asset is referenced by content. Pass ?force=true to override.');
    }
  }

  // Remove from Cloudinary
  await deleteFromCloudinary(publicId);

  res.json({ ok: true, deleted: publicId });
});
