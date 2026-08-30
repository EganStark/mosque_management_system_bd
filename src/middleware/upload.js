// Multer config for image uploads (member/family photos, company logo).
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const supabaseStorage = require('../services/supabase-storage');

const UPLOAD_DIR = process.env.IMAGE_UPLOAD_DIR
  ? path.resolve(process.env.IMAGE_UPLOAD_DIR)
  : path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const extensions = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif', 'image/webp': '.webp' };
    const ext = extensions[file.mimetype] || '';
    const safeField = String(file.fieldname || 'image').replace(/[^a-z0-9_-]/gi, '').slice(0, 30) || 'image';
    const safe = `${safeField}-${Date.now()}-${crypto.randomBytes(12).toString('hex')}${ext}`;
    cb(null, safe);
  },
});

const fileFilter = (req, file, cb) => {
  const ok = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.mimetype);
  cb(ok ? null : new Error('শুধুমাত্র ছবি আপলোড করা যাবে (jpg, png, gif, webp)।'), ok);
};

const localUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 4 * 1024 * 1024 }, // 4 MB
});

const imageExtensions = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif', 'image/webp': '.webp' };

async function persistSupabaseFiles(req) {
  const files = req.file ? [req.file] : Object.values(req.files || {}).flat();
  const uploaded = [];
  try {
    for (const file of files) {
      const safeField = String(file.fieldname || 'image').replace(/[^a-z0-9_-]/gi, '').slice(0, 30) || 'image';
      const key = `images/${safeField}-${Date.now()}-${crypto.randomBytes(12).toString('hex')}${imageExtensions[file.mimetype] || ''}`;
      file.publicUrl = await supabaseStorage.uploadPublicImage(file, key);
      file.filename = key;
      file.path = file.publicUrl;
      uploaded.push(file.publicUrl);
      delete file.buffer;
    }
  } catch (error) {
    await Promise.all(uploaded.map((value) => supabaseStorage.removePublicImage(value).catch(() => false)));
    throw error;
  }
}

function remoteMiddleware(parser) {
  return (req, res, next) => parser(req, res, async (error) => {
    if (error) return next(error);
    try {
      await persistSupabaseFiles(req);
      return next();
    } catch (uploadError) {
      return next(uploadError);
    }
  });
}

const memoryUpload = multer({ storage: multer.memoryStorage(), fileFilter, limits: { fileSize: 4 * 1024 * 1024 } });
const upload = supabaseStorage.enabled()
  ? {
      single: (field) => remoteMiddleware(memoryUpload.single(field)),
      fields: (fields) => remoteMiddleware(memoryUpload.fields(fields)),
    }
  : localUpload;

function uploadedPublicUrl(file) {
  if (!file) return undefined;
  return file.publicUrl || `/uploads/${file.filename}`;
}

function uploadedFilePath(publicPath) {
  const value = String(publicPath || '').replace(/\\/g, '/');
  if (!value.startsWith('/uploads/')) return null;
  const filename = value.slice('/uploads/'.length);
  if (!filename || filename !== path.basename(filename)) return null;
  const resolved = path.resolve(UPLOAD_DIR, filename);
  return path.dirname(resolved) === path.resolve(UPLOAD_DIR) ? resolved : null;
}

async function removeUploadedFile(publicPath) {
  if (supabaseStorage.objectKeyFromPublicUrl(publicPath)) return supabaseStorage.removePublicImage(publicPath);
  const target = uploadedFilePath(publicPath);
  if (!target) return false;
  try {
    await fs.promises.unlink(target);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

module.exports = { upload, UPLOAD_DIR, uploadedFilePath, uploadedPublicUrl, removeUploadedFile };
