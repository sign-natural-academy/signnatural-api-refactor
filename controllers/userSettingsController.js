// controllers/userSettingsController.js
import asyncHandler from "express-async-handler";
import UserSettings from "../models/UserSettings.js";

export const getMySettings = asyncHandler(async (req, res) => {
  if (!req?.user?._id) {
    res.status(401);
    throw new Error("Unauthorized: missing authenticated user");
  }

  const doc = await UserSettings.findOne({ user: req.user._id });
  if (!doc) {
    const created = await UserSettings.create({ user: req.user._id });
    return res.json(created);
  }
  res.json(doc);
});

export const updateMySettings = asyncHandler(async (req, res) => {
  if (!req?.user?._id) {
    res.status(401);
    throw new Error("Unauthorized: missing authenticated user");
  }

  const { notifications } = req.body || {};
  const doc = await UserSettings.findOneAndUpdate(
    { user: req.user._id },
    { $set: { ...(notifications ? { notifications } : {}) } },
    { new: true, upsert: true }
  );
  res.json(doc);
});
