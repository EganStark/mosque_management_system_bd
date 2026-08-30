const express = require('express');
const multer = require('multer');
const { requireAuth, adminOnly } = require('../middleware/auth');
const backups = require('../services/backups');
const uploadStorage = require('../services/upload-storage');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024, files: 1 }, fileFilter: (req, file, cb) => cb(null, file.mimetype === 'application/json' || file.originalname.toLowerCase().endsWith('.json')) });
router.use(requireAuth, adminOnly);

router.get('/', async (req, res, next) => {
  try {
    const [stats, storage] = await Promise.all([backups.stats(), uploadStorage.report()]);
    res.render('backups/index', { title: 'ব্যাকআপ ও পুনরুদ্ধার', stats, storage });
  } catch (err) { next(err); }
});
router.get('/download', async (req, res, next) => {
  try {
    const payload = await backups.exportData();
    const filename = `brjm-backup-${payload.createdAt.replace(/[:.]/g, '-')}.json`;
    res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.setHeader('Content-Disposition', `attachment; filename="${filename}"`); res.send(JSON.stringify(payload, null, 2));
  } catch (err) { next(err); }
});
router.post('/validate', upload.single('backup_file'), async (req, res) => {
  try {
    if (!req.file) throw new Error('Backup file is required');
    const payload = JSON.parse(req.file.buffer.toString('utf8')); backups.validate(payload);
    const tableCount = Object.keys(payload.tables).length; const rowCount = Object.values(payload.tables).reduce((sum, rows) => sum + rows.length, 0);
    req.flash('success', `ব্যাকআপটি বৈধ: ${tableCount}টি টেবিল এবং ${rowCount}টি রেকর্ড।`);
  } catch (err) { req.flash('error', `ব্যাকআপ যাচাই ব্যর্থ: ${err.message}`); }
  res.redirect('/backups');
});
router.post('/restore', upload.single('backup_file'), async (req, res) => {
  try {
    if (req.body.confirmation !== 'RESTORE') throw new Error('Confirmation phrase does not match');
    if (!req.file) throw new Error('Backup file is required');
    const payload = JSON.parse(req.file.buffer.toString('utf8'));
    const recovery = await backups.restore(payload);
    req.flash('success', `ডেটাবেস পুনরুদ্ধার হয়েছে। আগের ডেটার রিকভারি কপি: ${recovery.filename}`);
  } catch (err) { req.flash('error', `পুনরুদ্ধার ব্যর্থ: ${err.message}`); }
  res.redirect('/backups');
});
router.post('/uploads/cleanup', async (req, res) => {
  try {
    if (req.body.confirmation !== 'DELETE') throw new Error('Confirmation phrase does not match');
    const result = await uploadStorage.cleanup(req.body.selected);
    req.flash('success', `${result.removed}টি অনাথ আপলোড মুছে ফেলা হয়েছে।`);
  } catch (err) {
    req.flash('error', `আপলোড পরিষ্কার করা যায়নি: ${err.message}`);
  }
  res.redirect('/backups');
});

module.exports = router;
