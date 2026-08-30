const express = require('express');
const { body, validationResult } = require('express-validator');
const { requireAuth, canWrite } = require('../middleware/auth');
const deceased = require('../services/deceased');
const members = require('../services/members');

const router = express.Router();
router.use(requireAuth);
router.get('/', async (req, res, next) => { try { res.render('deceased/list', { title: 'মরহুম সদস্য রেজিস্টার', rows: await deceased.list() }); } catch (err) { next(err); } });
router.get('/new', canWrite, async (req, res, next) => { try { const all = await members.list(); res.render('deceased/form', { title: 'মৃত্যু ও জানাজা তথ্য', memberOptions: all.filter((m) => m.status === 'active') }); } catch (err) { next(err); } });
router.post('/', canWrite, body('member_id').isInt(), body('death_date').isISO8601(), async (req, res, next) => {
  try {
    if (!validationResult(req).isEmpty()) { req.flash('error', 'সদস্য ও মৃত্যুর তারিখ নির্বাচন করুন।'); return res.redirect('/deceased/new'); }
    const record = await deceased.mark(req.body, req.session.user.id); req.flash('success', 'সদস্যের মৃত্যু তথ্য সংরক্ষণ এবং মাসিক বিল বন্ধ করা হয়েছে।'); res.redirect(`/deceased/${record.id}`);
  } catch (err) { req.flash('error', err.message === 'Member already recorded as deceased' ? 'এই সদস্য ইতোমধ্যে মরহুম রেজিস্টারে আছেন।' : err.message); res.redirect('/deceased/new'); }
});
router.get('/:id', async (req, res, next) => { try { const record = await deceased.find(req.params.id); if (!record) return res.status(404).render('error', { title: 'পাওয়া যায়নি', status: 404, message: 'রেকর্ড পাওয়া যায়নি।' }); res.render('deceased/view', { title: record.member_name, record }); } catch (err) { next(err); } });
module.exports = router;
