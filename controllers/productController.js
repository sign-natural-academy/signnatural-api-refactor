// controllers/productController.js
import asyncHandler from 'express-async-handler';
import Product from '../models/Product.js';
import { uploadBufferToCloudinary, deleteFromCloudinary } from '../config/cloudinary.js';
import { logAudit } from '../utils/audit.js';

const createProduct = asyncHandler(async (req, res) => {
  const data = req.body || {};
  let image = data.image || null;
  let imagePublicId = data.imagePublicId || null;

  if (req.file && req.file.buffer) {
    try {
      const result = await uploadBufferToCloudinary(req.file.buffer, {
        folder: 'signnatural/products',
        transformation: [{ width: 1600, crop: 'limit' }],
      });
      image = result.secure_url;
      imagePublicId = result.public_id;
    } catch (err) {
      console.error('Cloudinary upload failed (createProduct):', err.message || err);
    }
  }

  const p = await Product.create({ ...data, image, imagePublicId });

  // AUDIT (non-blocking): product created
  try {
    await logAudit({
      actorId: req.user._id,
      action: 'PRODUCT_CREATED',
      entityType: 'Product',
      entityId: p._id,
      meta: { name: p.name, price: p.price, stock: p.stock },
      req,
    });
  } catch (e) {
    console.warn('audit log failed (PRODUCT_CREATED):', e?.message || e);
  }

  res.status(201).json(p);
});

const getProducts = asyncHandler(async (req, res) => {
  const products = await Product.find();
  res.json(products);
});

const updateProduct = asyncHandler(async (req, res) => {
  const p = await Product.findById(req.params.id);
  if (!p) {
    res.status(404);
    throw new Error('Product not found');
  }

  // If file present, upload and delete previous
  if (req.file && req.file.buffer) {
    try {
      if (p.imagePublicId) {
        try { await deleteFromCloudinary(p.imagePublicId); } catch (err) { /* log and continue */ }
      }
      const result = await uploadBufferToCloudinary(req.file.buffer, {
        folder: 'signnatural/products',
        transformation: [{ width: 1600, crop: 'limit' }],
      });
      p.image = result.secure_url;
      p.imagePublicId = result.public_id;
    } catch (err) {
      console.error('Cloudinary upload failed (updateProduct):', err?.message || err);
      // continue
    }
  }

  // Apply updates from body (keep same pattern as courses/workshops)
  Object.keys(req.body || {}).forEach((k) => {
    // protect certain fields if needed, e.g. _id
    if (k === '_id') return;
    p[k] = req.body[k];
  });

  await p.save();

  // Audit log
  try {
    const after = { name: p.name, price: p.price, relatedWorkshop: p.relatedWorkshop };
    await logAudit({
      actorId: req.user._id,
      action: 'PRODUCT_UPDATED',
      entityType: 'Product',
      entityId: p._id,
      meta: { before: undefined, after }, // optional: can be enhanced to include before snapshot
      req,
    });
  } catch (e) {
    console.warn('audit failed', e?.message || e);
  }

  res.json(p);
});

/**
 * DELETE /api/products/:id
 * Admin - remove product and its Cloudinary asset if present
 */
const deleteProduct = asyncHandler(async (req, res) => {
  const p = await Product.findById(req.params.id);
  if (!p) {
    res.status(404);
    throw new Error('Product not found');
  }

  // remove cloudinary asset if exists
  if (p.imagePublicId) {
    try { await deleteFromCloudinary(p.imagePublicId); } catch (err) { console.error('Cloudinary delete failed (deleteProduct):', err?.message || err); }
  }

  await p.deleteOne();

  try {
    await logAudit({
      actorId: req.user._id,
      action: 'PRODUCT_DELETED',
      entityType: 'Product',
      entityId: p._id,
      meta: { name: p.name, hadImage: !!p.imagePublicId },
      req,
    });
  } catch (e) { console.warn('audit failed', e?.message || e); }

  res.json({ ok: true, message: 'Product deleted' });
});

export { createProduct, getProducts , updateProduct, deleteProduct };
