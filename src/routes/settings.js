const express = require('express');
const { requireAuth, adminOnly } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const settingsService = require('../services/settings');
const { invalidateSettingsCache } = require('../middleware/locals');

const router = express.Router();
router.use(requireAuth, adminOnly);

router.get('/company', async (req, res, next) => {
  try {
    res.render('settings/company', { title: 'প্রতিষ্ঠানের তথ্য', company: await settingsService.get() });
  } catch (err) { next(err); }
});

router.post('/company', upload.single('logo'), async (req, res, next) => {
  try {
    const data = {
      company_name: req.body.company_name,
      company_address: req.body.company_address || null,
      company_phone: req.body.company_phone || null,
      company_email: req.body.company_email || null,
    };
    if (req.file) data.logo = '/uploads/' + req.file.filename;
    await settingsService.upsert(data);
    invalidateSettingsCache();
    req.flash('success', 'তথ্য সংরক্ষণ হয়েছে।');
    res.redirect('/settings/company');
  } catch (err) { next(err); }
});

module.exports = router;
