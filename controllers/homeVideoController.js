// controllers/homeVideoController.js
import HomeVideo from "../models/HomeVideo.js";
import { uploadBufferToCloudinary, deleteFromCloudinary } from "../config/cloudinary.js";
import { logAudit } from "../utils/audit.js";

const MAX_VIDEO_BYTES = 10 * 1024 * 1024; // 10 MB

// PUBLIC: GET /api/home-video
// Returns the latest published home video (or null)
export async function getPublicHomeVideo(req, res) {
  try {
    const doc = await HomeVideo.findOne({ published: true })
      .sort({ createdAt: -1 })
      .lean();
    res.json(doc || null);
  } catch (e) {
    console.error("getPublicHomeVideo error:", e);
    res.status(500).json({ message: "Failed to load home video" });
  }
}

// ADMIN: GET /api/home-video/admin
export async function adminListHomeVideos(req, res) {
  try {
    const items = await HomeVideo.find({})
      .sort({ createdAt: -1 })
      .lean();
    res.json(items);
  } catch (e) {
    console.error("adminListHomeVideos error:", e);
    res.status(500).json({ message: "Failed to list home videos" });
  }
}

// ADMIN: POST /api/home-video/admin
// Accepts either:
//  - body.youtubeUrl   (string)
//  - file "video"      (<=10MB, uploaded to Cloudinary)
export async function adminCreateHomeVideo(req, res) {
  try {
    const { title, caption = "", youtubeUrl } = req.body || {};
    if (!title) {
      return res.status(400).json({ message: "Title is required" });
    }

    let videoUrl = (youtubeUrl || "").trim() || null;
    let videoPublicId = null;

    // If we have an uploaded file, use that (and ignore youtubeUrl)
    if (req.file && req.file.buffer) {
      if (req.file.size > MAX_VIDEO_BYTES) {
        return res.status(400).json({ message: "Video must be ≤ 10 MB" });
      }

      try {
        const result = await uploadBufferToCloudinary(req.file.buffer, {
          folder: "signnatural/home",
          resource_type: "video",
          // keep it simple: Cloudinary will handle encoding
        });
        videoUrl = result.secure_url;
        videoPublicId = result.public_id;
      } catch (err) {
        console.error("Cloudinary upload failed (home video):", err?.message || err);
        return res.status(500).json({ message: "Failed to upload video" });
      }
    }

    if (!videoUrl) {
      return res.status(400).json({ message: "Provide a YouTube URL or upload a video." });
    }

    const doc = await HomeVideo.create({
      title,
      caption,
      videoUrl,
      videoPublicId,
      published: true, // default publish
      createdBy: req.user?._id,
    });

    // AUDIT (non-blocking)
    try {
      await logAudit({
        actorId: req.user?._id,
        action: "HOME_VIDEO_CREATED",
        entityType: "HomeVideo",
        entityId: doc._id,
        meta: { title: doc.title, videoUrl: doc.videoUrl },
        req,
      });
    } catch (e) {
      console.warn("audit log failed (HOME_VIDEO_CREATED):", e?.message || e);
    }

    res.status(201).json(doc);
  } catch (e) {
    console.error("adminCreateHomeVideo error:", e);
    res.status(500).json({ message: "Failed to create home video" });
  }
}

// ADMIN: PATCH /api/home-video/admin/:id
export async function adminUpdateHomeVideo(req, res) {
  try {
    const { id } = req.params;
    const doc = await HomeVideo.findById(id);
    if (!doc) return res.status(404).json({ message: "Home video not found" });

    const before = {
      title: doc.title,
      caption: doc.caption,
      published: doc.published,
      videoUrl: doc.videoUrl,
    };

    const { title, caption, published } = req.body || {};
    if (title !== undefined) doc.title = title;
    if (caption !== undefined) doc.caption = caption;
    if (published !== undefined) doc.published = !!published;

    await doc.save();

    const after = {
      title: doc.title,
      caption: doc.caption,
      published: doc.published,
      videoUrl: doc.videoUrl,
    };

    try {
      await logAudit({
        actorId: req.user?._id,
        action: "HOME_VIDEO_UPDATED",
        entityType: "HomeVideo",
        entityId: doc._id,
        meta: { before, after },
        req,
      });
    } catch (e) {
      console.warn("audit log failed (HOME_VIDEO_UPDATED):", e?.message || e);
    }

    res.json(doc);
  } catch (e) {
    console.error("adminUpdateHomeVideo error:", e);
    res.status(500).json({ message: "Failed to update home video" });
  }
}

// ADMIN: DELETE /api/home-video/admin/:id
export async function adminDeleteHomeVideo(req, res) {
  try {
    const { id } = req.params;
    const doc = await HomeVideo.findById(id);
    if (!doc) return res.status(404).json({ message: "Home video not found" });

    if (doc.videoPublicId) {
      try {
        await deleteFromCloudinary(doc.videoPublicId);
      } catch (err) {
        console.error("Cloudinary delete failed (home video):", err?.message || err);
      }
    }

    await doc.deleteOne();

    try {
      await logAudit({
        actorId: req.user?._id,
        action: "HOME_VIDEO_DELETED",
        entityType: "HomeVideo",
        entityId: doc._id,
        meta: { title: doc.title },
        req,
      });
    } catch (e) {
      console.warn("audit log failed (HOME_VIDEO_DELETED):", e?.message || e);
    }

    res.json({ ok: true });
  } catch (e) {
    console.error("adminDeleteHomeVideo error:", e);
    res.status(500).json({ message: "Failed to delete home video" });
  }
}
