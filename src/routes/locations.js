const express = require('express');
const { requireAuth, adminOnly } = require('../middleware/auth');
const loc = require('../services/locations');

const router = express.Router();

// --- JSON cascading endpoints (used by the member form) ---
// GET /locations/api/:level?parent_id=123
router.get('/api/:level', requireAuth, async (req, res, next) => {
  try {
    const { level } = req.params;
    if (!loc.LEVELS[level]) return res.status(404).json([]);
    const rows = req.query.parent_id
      ? await loc.byParent(level, req.query.parent_id)
      : await loc.all(level);
    res.json(rows.map((r) => ({ id: r.id, name: r.name, post_code: r.post_code })));
  } catch (err) {
    next(err);
  }
});

// --- Management pages (admin only) ---
const PARENT_OF = {
  district: { level: 'division', label: 'বিভাগ' },
  thana: { level: 'district', label: 'জেলা' },
  post_office: { level: 'thana', label: 'থানা' },
  village: { level: 'post_office', label: 'পোস্ট অফিস' },
  area: { level: 'village', label: 'গ্রাম' },
};

const LABELS = {
  division: 'বিভাগ', district: 'জেলা', thana: 'থানা',
  post_office: 'পোস্ট অফিস', village: 'গ্রাম', area: 'এলাকা',
};

router.use(requireAuth, adminOnly);

router.get('/:level', async (req, res, next) => {
  try {
    const { level } = req.params;
    if (!loc.LEVELS[level]) return res.redirect('/locations/division');
    const rows = await loc.listWithParent(level);
    const parentCfg = PARENT_OF[level];
    const parents = parentCfg ? await loc.all(parentCfg.level) : [];
    res.render('locations/index', {
      title: LABELS[level] + ' ব্যবস্থাপনা',
      level, rows, parents, parentCfg, labels: LABELS,
      parentCol: loc.LEVELS[level].parent,
      hasPostCode: level === 'post_office',
    });
  } catch (err) {
    next(err);
  }
});

router.post('/:level', async (req, res, next) => {
  try {
    const { level } = req.params;
    if (!loc.LEVELS[level]) return res.redirect('/locations/division');
    const data = { name: req.body.name };
    const cfg = loc.LEVELS[level];
    if (cfg.parent) data[cfg.parent] = req.body[cfg.parent] || req.body.parent_id;
    if (level === 'post_office') data.post_code = req.body.post_code || null;
    await loc.create(level, data);
    req.flash('success', LABELS[level] + ' যুক্ত হয়েছে।');
    res.redirect('/locations/' + level);
  } catch (err) {
    next(err);
  }
});

router.post('/:level/:id', async (req, res, next) => {
  try {
    const { level, id } = req.params;
    const data = { name: req.body.name };
    const cfg = loc.LEVELS[level];
    if (cfg.parent) data[cfg.parent] = req.body[cfg.parent] || req.body.parent_id;
    if (level === 'post_office') data.post_code = req.body.post_code || null;
    await loc.update(level, id, data);
    req.flash('success', 'হালনাগাদ হয়েছে।');
    res.redirect('/locations/' + level);
  } catch (err) {
    next(err);
  }
});

router.post('/:level/:id/delete', async (req, res, next) => {
  try {
    await loc.remove(req.params.level, req.params.id);
    req.flash('success', 'মুছে ফেলা হয়েছে।');
    res.redirect('/locations/' + req.params.level);
  } catch (err) {
    req.flash('error', 'মুছে ফেলা যায়নি — সম্ভবত এটি অন্য কোথাও ব্যবহৃত হচ্ছে।');
    res.redirect('/locations/' + req.params.level);
  }
});

module.exports = router;
