// models/Course.js
import mongoose from 'mongoose';

const CourseSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  type: { type: String, enum: ['free', 'online', 'in-person', 'in-demand'], default: 'free' },

  // image fields (existing)
  image: { type: String, default: null },            // secure url (Cloudinary or other)
  imagePublicId: { type: String, default: null },    // cloudinary public_id for deletion

  // video fields (new) — used for free tutorials (video either youtube link or uploaded)
  videoUrl: { type: String, default: null },         // YouTube URL or uploaded secure_url
  videoType: { type: String, enum: ['youtube', 'upload', null], default: null },
  videoPublicId: { type: String, default: null },    // cloudinary public_id for uploaded video
  videoSize: { type: Number, default: null },        // size in bytes (optional)

  price: { type: Number, default: 0 },
  duration: String,
  location: String,
  category: String,
  instructor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  published: { type: Boolean, default: true },
  meta: { type: Object }
}, { timestamps: true });

export default mongoose.model('Course', CourseSchema);
