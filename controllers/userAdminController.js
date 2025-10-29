// controllers/userAdminController.js
import asyncHandler from "express-async-handler";
import User from "../models/User.js";
import { sendToAdmins } from "../utils/sseHub.js";

/** GET /api/users?search=&role=&page=&limit=  (admin) */
export const listUsers = asyncHandler(async (req, res) => {
  const { search = "", role, page = 1, limit = 20 } = req.query;
  const q = {};

  if (search) {
    const s = String(search).trim();
    q.$or = [
      { name:   { $regex: s, $options: "i" } },
      { email:  { $regex: s, $options: "i" } },
    ];
  }
  if (role && ["user", "admin"].includes(role)) {
    q.role = role;
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const lim = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

  const [items, total] = await Promise.all([
    User.find(q).sort({ createdAt: -1 }).skip((pageNum - 1) * lim).limit(lim).lean(),
    User.countDocuments(q),
  ]);

  res.json({
    items: items.map(u => ({
      _id: u._id,
      name: u.name,
      email: u.email,
      role: u.role,
      isActive: u.isActive,
      createdAt: u.createdAt,
    })),
    page: pageNum,
    limit: lim,
    total,
  });
});

/** PATCH /api/users/:id/role  body: { role: "user"|"admin" } (admin) */
export const setUserRole = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  if (!["user", "admin"].includes(role)) {
    res.status(400); throw new Error('Invalid role. Use "user" or "admin".');
  }

  const user = await User.findById(id);
  if (!user) { res.status(404); throw new Error("User not found"); }

  // prevent removing last admin
  if (user.role === "admin" && role === "user") {
    const adminCount = await User.countDocuments({ role: "admin", isActive: true });
    if (adminCount <= 1) {
      res.status(400); throw new Error("Cannot demote the last active admin");
    }
  }

  user.role = role;
  await user.save();

  // SSE: admin board
  sendToAdmins({
    kind: "admin_board",
    type: "user_updated",
    message: `Role changed: ${user.email} → ${role}`,
    entity: { id, role },
    createdAt: new Date().toISOString(),
  });

  res.json({ _id: user._id, role: user.role });
});

/** PATCH /api/users/:id/status  body: { isActive: boolean } (admin) */
export const setUserStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { isActive } = req.body;

  if (typeof isActive !== "boolean") {
    res.status(400); throw new Error("isActive must be boolean");
  }

  const user = await User.findById(id);
  if (!user) { res.status(404); throw new Error("User not found"); }

  // don't disable last admin
  if (user.role === "admin" && isActive === false) {
    const adminCount = await User.countDocuments({ role: "admin", isActive: true });
    if (adminCount <= 1) {
      res.status(400); throw new Error("Cannot disable the last active admin");
    }
  }

  user.isActive = isActive;
  await user.save();

  sendToAdmins({
    kind: "admin_board",
    type: "user_updated",
    message: `${user.email} is now ${isActive ? "ENABLED" : "DISABLED"}`,
    entity: { id, isActive },
    createdAt: new Date().toISOString(),
  });

  res.json({ _id: user._id, isActive: user.isActive });
});

/** DELETE /api/users/:id  (soft delete → isActive=false) (admin) */
export const softDeleteUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = await User.findById(id);
  if (!user) { res.status(404); throw new Error("User not found"); }

  if (user.role === "admin") {
    const adminCount = await User.countDocuments({ role: "admin", isActive: true });
    if (adminCount <= 1) {
      res.status(400); throw new Error("Cannot remove the last active admin");
    }
  }

  if (!user.isActive) {
    return res.json({ _id: user._id, isActive: user.isActive }); // already disabled
  }

  user.isActive = false;
  await user.save();

  sendToAdmins({
    kind: "admin_board",
    type: "user_updated",
    message: `Soft-deleted: ${user.email}`,
    entity: { id, isActive: false, softDeleted: true },
    createdAt: new Date().toISOString(),
  });

  res.json({ _id: user._id, isActive: false });
});
