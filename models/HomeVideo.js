// models/HomeVideo.js
import mongoose from "mongoose";

const HomeVideoSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    caption: { type: String, default: "" },

    // Where the video actually lives (YouTube URL or Cloudinary URL)
    videoUrl: { type: String, required: true },

    // If uploaded to Cloudinary, store public_id so we can delete later
    videoPublicId: { type: String, default: null },

    // Optional thumbnail / poster (you can add this later if you want)
    thumbnail: { type: String, default: null },

    published: { type: Boolean, default: true }, // only published shows on home

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export default mongoose.model("HomeVideo", HomeVideoSchema);
