const express = require('express');
const { body, validationResult } = require('express-validator');
const { requireAuth, canWrite } = require('../middleware/auth');
const assets = require('../services/assets');
const members = require('../services/members');

const router = express.Router();
router.use(requireAuth);
const assetValidation = [body('name').trim().notEmpty(), body('asset_code').trim().notEmpty(), body('quantity').isFloat({ gt: 0 }), body('purchase_price').optional({ checkFalsy: true }).isFloat({ min: 0 })];

async function formData() { return { categories: await assets.categories.all(), memberOptions: await members.options() }; }

router.get('/', async (req, res, next) => { try { res.render('assets/list', { title: 'সম্পদ রেজিস্টার', rows: await assets.list(), summary: await assets.summary() }); } catch (err) { next(err); } });
router.get('/new', canWrite, async (req, res, next) => { try { res.render('assets/form', { title: 'নতুন সম্পদ', asset: null, nextCode: await assets.nextCode(), ...(await formData()) }); } catch (err) { next(err); } });
router.post('/', canWrite, assetValidation, async (req, res, next) => {
  try { if (!validationResult(req).isEmpty()) { req.flash('error', 'নাম, কোড এবং পরিমাণ সঠিকভাবে দিন।'); return res.redirect('/assets/new'); } await assets.create({ ...req.body, created_by: req.session.user.id }); req.flash('success', 'সম্পদ রেজিস্টারে যুক্ত হয়েছে।'); res.redirect('/assets'); }
  catch (err) { if (err.code === '23505') { req.flash('error', 'এই সম্পদ কোড আগে থেকেই আছে।'); return res.redirect('/assets/new'); } next(err); }
});
router.get('/:id', async (req, res, next) => { try { const asset = await assets.find(req.params.id); if (!asset) return res.status(404).render('error', { title: 'পাওয়া যায়নি', status: 404, message: 'সম্পদটি পাওয়া যায়নি।' }); res.render('assets/view', { title: asset.name, asset }); } catch (err) { next(err); } });
router.get('/:id/edit', canWrite, async (req, res, next) => { try { const asset = await assets.find(req.params.id); if (!asset) return res.redirect('/assets'); res.render('assets/form', { title: 'সম্পদ সম্পাদনা', asset, nextCode: asset.asset_code, ...(await formData()) }); } catch (err) { next(err); } });
router.post('/:id', canWrite, assetValidation, async (req, res, next) => { try { if (!validationResult(req).isEmpty()) { req.flash('error', 'তথ্য সঠিকভাবে দিন।'); return res.redirect(`/assets/${req.params.id}/edit`); } await assets.update(req.params.id, req.body); req.flash('success', 'সম্পদের তথ্য হালনাগাদ হয়েছে।'); res.redirect(`/assets/${req.params.id}`); } catch (err) { next(err); } });
router.post('/:id/maintenance', canWrite, body('maintenance_date').isISO8601(), body('description').trim().notEmpty(), async (req, res, next) => { try { if (!validationResult(req).isEmpty()) { req.flash('error', 'রক্ষণাবেক্ষণের তারিখ ও বিবরণ দিন।'); return res.redirect(`/assets/${req.params.id}`); } await assets.addMaintenance(req.params.id, { ...req.body, cost: req.body.cost || 0, created_by: req.session.user.id }); req.flash('success', 'রক্ষণাবেক্ষণের ইতিহাস যুক্ত হয়েছে।'); res.redirect(`/assets/${req.params.id}`); } catch (err) { next(err); } });

module.exports = router;
