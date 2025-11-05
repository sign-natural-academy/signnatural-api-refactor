//controllers/workshopController.js

import asyncHandler from 'express-async-handler';
import Workshop from '../models/Workshop.js';
import { uploadBufferToCloudinary, deleteFromCloudinary } from '../config/cloudinary.js';


const createWorkshop = asyncHandler(async (req, res) => {
  const data = req.body || {};
  let image = data.image || null;
  let imagePublicId = data.imagePublicId || null;

  if (req.file && req.file.buffer) {
    try {
      const result = await uploadBufferToCloudinary(req.file.buffer, {
        folder: 'signnatural/workshops',
        transformation: [{ width: 1600, crop: 'limit' }],
      });
      image = result.secure_url;
      imagePublicId = result.public_id;
    } catch (err) {
      console.error('Cloudinary upload failed (createWorkshop):', err.message || err);
    }
  }

  const ws = await Workshop.create({ ...data, host: req.user ? req.user._id : data.host, image, imagePublicId });
  res.status(201).json(ws);
});

const getWorkshops = asyncHandler(async (req, res) => {
  const { q, type, location, page = 1, limit = 20 } = req.query;
  const filter = {};
  if (type) filter.type = type;
  if (location) filter.location = location;
  if (q) filter.$or = [{ title: new RegExp(q, 'i') }, { description: new RegExp(q, 'i') }];
  const ws = await Workshop.find(filter).skip((page - 1) * limit).limit(parseInt(limit, 10));
  res.json(ws);
});

const getWorkshop = asyncHandler(async (req, res) => {
  const ws = await Workshop.findById(req.params.id);
  if (!ws) { res.status(404); throw new Error('Workshop not found'); }
  res.json(ws);
});

const updateWorkshop = asyncHandler(async (req, res) => {
  const ws = await Workshop.findById(req.params.id);
  if (!ws) { res.status(404); throw new Error('Workshop not found'); }

  if (req.file && req.file.buffer) {
    try {
      if (ws.imagePublicId) {
        try { await deleteFromCloudinary(ws.imagePublicId); } catch (err) { /* continue */ }
      }
      const result = await uploadBufferToCloudinary(req.file.buffer, {
        folder: 'signnatural/workshops',
        transformation: [{ width: 1600, crop: 'limit' }],
      });
      ws.image = result.secure_url;
      ws.imagePublicId = result.public_id;
    } catch (err) {
      console.error('Cloudinary upload failed (updateWorkshop):', err.message || err);
    }
  }

  Object.keys(req.body || {}).forEach((k) => { ws[k] = req.body[k]; });
  await ws.save();
  res.json(ws);
});

const deleteWorkshop = asyncHandler(async (req, res) => {
  const ws = await Workshop.findById(req.params.id);
  if (!ws) { res.status(404); throw new Error('Workshop not found'); }

  if (ws.imagePublicId) {
    try { await deleteFromCloudinary(ws.imagePublicId); } catch (err) { console.error('Cloudinary delete failed (deleteWorkshop):', err.message || err); }
  }

 // Document-level deletion (safe and supported)
  await ws.deleteOne();
  


  res.json({ ok: true, message: 'workshop deleted' });
});

export { createWorkshop, getWorkshops, getWorkshop, updateWorkshop, deleteWorkshop };
