// routes/homeVideoRoutes.js
import express from "express";
import {
  getPublicHomeVideo,
  adminListHomeVideos,
  adminCreateHomeVideo,
  adminUpdateHomeVideo,
  adminDeleteHomeVideo,
} from "../controllers/homeVideoController.js";

import { protect, requireAdminOrSuper } from "../middlewares/authMiddleware.js";
import { upload } from "../middlewares/uploads.js";

const router = express.Router();

// PUBLIC: used by homepage
router.get("/", getPublicHomeVideo);

// ADMIN: list
router.get("/admin", protect, requireAdminOrSuper, adminListHomeVideos);

// ADMIN: create (video upload or youtube url)
router.post(
  "/admin",
  protect,
  requireAdminOrSuper,
  upload.single("video"), // same pattern as courses
  adminCreateHomeVideo
);

// ADMIN: update (title/caption/published)
router.patch(
  "/admin/:id",
  protect,
  requireAdminOrSuper,
  adminUpdateHomeVideo
);

// ADMIN: delete
router.delete(
  "/admin/:id",
  protect,
  requireAdminOrSuper,
  adminDeleteHomeVideo
);

export default router;
