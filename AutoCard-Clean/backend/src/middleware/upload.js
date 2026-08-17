import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper function to get upload directory based on environment
function getUploadDir(subdir) {
  // On Vercel, use /tmp directory (only writable location)
  if (process.env.VERCEL === "1") {
    const tmpDir = path.join("/tmp", subdir);
    // Ensure directory exists
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    return tmpDir;
  }
  
  // Local development - use uploads directory
  const localDir = path.join(__dirname, "../../uploads", subdir);
  if (!fs.existsSync(localDir)) {
    fs.mkdirSync(localDir, { recursive: true });
  }
  return localDir;
}

// ── Profile image storage ─────────────────────────────────────────────────────
const imageStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, getUploadDir("profiles"));
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext);
    cb(null, `${base}-${uniqueSuffix}${ext}`);
  },
});

const imageFilter = (_req, file, cb) => {
  const allowed = /jpeg|jpg|png|gif|webp/;
  if (allowed.test(path.extname(file.originalname).toLowerCase()) && allowed.test(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed (jpeg, jpg, png, gif, webp)"));
  }
};

export const upload = multer({
  storage: imageStorage,
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

// ── Resume / document storage ─────────────────────────────────────────────────
const documentStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, getUploadDir("documents"));
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext)
      .replace(/\s+/g, "_")   // spaces → underscores
      .replace(/[^a-zA-Z0-9_\-]/g, ""); // strip unsafe chars
    cb(null, `${base}-${uniqueSuffix}${ext}`);
  },
});

const documentFilter = (_req, file, cb) => {
  const allowedExts = /\.(pdf|doc|docx)$/i;
  const allowedMimes = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/octet-stream",
    "application/vnd.ms-office",
  ];

  const extOk = allowedExts.test(path.extname(file.originalname));
  const mimeOk = allowedMimes.includes(file.mimetype);

  if (extOk || mimeOk) {
    cb(null, true);
  } else {
    cb(new Error("Only PDF, DOC, or DOCX files are allowed."));
  }
};

export const uploadDocument = multer({
  storage: documentStorage,
  fileFilter: documentFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});
