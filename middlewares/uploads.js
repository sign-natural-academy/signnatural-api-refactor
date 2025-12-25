// middlewares/uploads.js
import multer from "multer";

// 🔧 Increase limit to 100MB (matches large video uploads)
const MAX_FILE_SIZE = process.env.MAX_UPLOAD_SIZE
  ? parseInt(process.env.MAX_UPLOAD_SIZE, 10)
  : 100 * 1024 * 1024; // 100MB

const storage = multer.memoryStorage();

function fileFilter(req, file, cb) {
  if (!file || !file.mimetype) {
    return cb(null, false);
  }

  // ✅ Allow images and videos
  if (
    file.mimetype.startsWith("image/") ||
    file.mimetype.startsWith("video/")
  ) {
    return cb(null, true);
  }

  return cb(
    new Error("Only image and video files are allowed"),
    false
  );
}

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
  fileFilter,
});

export { upload };
