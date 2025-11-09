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

export { createProduct, getProducts };
