// routes/userAdminRoutes.js
import express from "express";
import { protect, requireAdmin } from "../middlewares/authMiddleware.js";
import {
  listUsers,
  setUserRole,
  setUserStatus,
  softDeleteUser,
} from "../controllers/userAdminController.js";

const router = express.Router();

router.get("/", protect, requireAdmin, listUsers);
router.patch("/:id/role", protect, requireAdmin, setUserRole);
router.patch("/:id/status", protect, requireAdmin, setUserStatus);
router.delete("/:id", protect, requireAdmin, softDeleteUser);

export default router;
