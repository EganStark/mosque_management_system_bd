const express = require('express');
const { requireAuth, adminOnly } = require('../middleware/auth');
const loc = require('../services/locations');

const router = express.Router();
router.use(requireAuth, adminOnly);

router.get('/', async (req, res, next) => {
  try {
    const rows = await loc.occupations.all();
    res.render('occupations/index', { title: 'পেশা ব্যবস্থাপনা', rows });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    await loc.occupations.create(req.body.name);
    req.flash('success', 'পেশা যুক্ত হয়েছে।');
    res.redirect('/occupations');
  } catch (err) {
    next(err);
  }
});

router.post('/:id', async (req, res, next) => {
  try {
    await loc.occupations.update(req.params.id, req.body.name);
    req.flash('success', 'হালনাগাদ হয়েছে।');
    res.redirect('/occupations');
  } catch (err) {
    next(err);
  }
});

router.post('/:id/delete', async (req, res, next) => {
  try {
    await loc.occupations.remove(req.params.id);
    req.flash('success', 'মুছে ফেলা হয়েছে।');
    res.redirect('/occupations');
  } catch (err) {
    req.flash('error', 'মুছে ফেলা যায়নি।');
    res.redirect('/occupations');
  }
});

module.exports = router;
