const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const supabaseStorage = require('../services/supabase-storage');

const DOCUMENT_DIR = process.env.DOCUMENT_STORAGE_DIR
  ? path.resolve(process.env.DOCUMENT_STORAGE_DIR)
  : path.resolve(__dirname, '..', '..', 'storage', 'documents');
if (!supabaseStorage.enabled() && !fs.existsSync(DOCUMENT_DIR)) fs.mkdirSync(DOCUMENT_DIR, { recursive: true });

const allowed = new Map([
  ['application/pdf', '.pdf'],
  ['application/msword', '.doc'],
  ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.docx'],
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
]);
const limits = { fileSize: 10 * 1024 * 1024, files: 1 };
const fileFilter = (_req, file, cb) => {
  const ok = allowed.has(file.mimetype);
  cb(ok ? null : new Error('শুধু PDF, DOC, DOCX, JPG বা PNG ফাইল গ্রহণযোগ্য।'), ok);
};

const localUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, DOCUMENT_DIR),
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(12).toString('hex')}${allowed.get(file.mimetype) || ''}`),
  }),
  limits,
  fileFilter,
});
const memoryUpload = multer({ storage: multer.memoryStorage(), limits, fileFilter });

function remoteSingle(field) {
  const parser = memoryUpload.single(field);
  return (req, res, next) => parser(req, res, async (error) => {
    if (error) return next(error);
    if (!req.file) return next();
    try {
      const key = `documents/${Date.now()}-${crypto.randomBytes(12).toString('hex')}${allowed.get(req.file.mimetype) || ''}`;
      await supabaseStorage.uploadPrivateDocument(req.file, key);
      req.file.filename = key;
      req.file.path = key;
      delete req.file.buffer;
      return next();
    } catch (uploadError) {
      return next(uploadError);
    }
  });
}

const documentUpload = supabaseStorage.enabled() ? { single: remoteSingle } : localUpload;

async function removeDocumentFile(file) {
  if (!file) return false;
  if (supabaseStorage.enabled()) return supabaseStorage.removePrivateDocument(file.filename || file.stored_name);
  const target = file.path || path.join(DOCUMENT_DIR, file.filename || file.stored_name || '');
  try {
    await fs.promises.unlink(target);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

module.exports = { documentUpload, DOCUMENT_DIR, removeDocumentFile };
