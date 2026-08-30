// Multer config for image uploads (member/family photos, company logo).
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const UPLOAD_DIR = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safe = `${file.fieldname}-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, safe);
  },
});

const fileFilter = (req, file, cb) => {
  const ok = /image\/(jpe?g|png|gif|webp)/.test(file.mimetype);
  cb(ok ? null : new Error('শুধুমাত্র ছবি আপলোড করা যাবে (jpg, png, gif, webp)।'), ok);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 4 * 1024 * 1024 }, // 4 MB
});

module.exports = { upload, UPLOAD_DIR };
