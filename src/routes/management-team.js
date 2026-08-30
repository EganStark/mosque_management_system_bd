const express = require('express');
const { body, validationResult } = require('express-validator');
const { requireAuth, adminOnly } = require('../middleware/auth');
const committees = require('../services/committees');
const members = require('../services/members');
const staff = require('../services/staff');

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try { res.render('management-team/index', { title: 'কমিটি ও স্টাফ', committees: await committees.list(), staffRows: await staff.list() }); }
  catch (err) { next(err); }
});

router.get('/committees/new', adminOnly, (req, res) => res.render('management-team/committee-form', { title: 'নতুন কমিটি' }));
router.post('/committees', adminOnly, body('name').trim().notEmpty(), body('start_date').isISO8601(), async (req, res, next) => {
  try {
    if (!validationResult(req).isEmpty()) { req.flash('error', 'কমিটির নাম ও শুরুর তারিখ দিন।'); return res.redirect('/management-team/committees/new'); }
    const row = await committees.create({ name: req.body.name, start_date: req.body.start_date, end_date: req.body.end_date || null, status: req.body.status === 'active' ? 'active' : 'completed', notes: req.body.notes || null });
    req.flash('success', 'কমিটি তৈরি হয়েছে।'); res.redirect(`/management-team/committees/${row.id}`);
  } catch (err) { next(err); }
});

router.get('/committees/:id', async (req, res, next) => {
  try {
    const committee = await committees.find(req.params.id);
    if (!committee) return res.status(404).render('error', { title: 'পাওয়া যায়নি', status: 404, message: 'কমিটি পাওয়া যায়নি।' });
    res.render('management-team/committee-view', { title: committee.name, committee, memberOptions: await members.options(), types: await committees.types.all() });
  } catch (err) { next(err); }
});

router.post('/committees/:id/members', adminOnly, body('member_id').isInt(), body('committee_type_id').isInt(), async (req, res, next) => {
  try {
    if (!validationResult(req).isEmpty()) { req.flash('error', 'সদস্য ও পদ নির্বাচন করুন।'); return res.redirect(`/management-team/committees/${req.params.id}`); }
    await committees.addMember(req.params.id, { member_id: req.body.member_id, committee_type_id: req.body.committee_type_id, sort_order: Number(req.body.sort_order || 0), appointed_at: req.body.appointed_at || null, status: 'active', notes: req.body.notes || null });
    req.flash('success', 'কমিটির সদস্য যুক্ত হয়েছে।'); res.redirect(`/management-team/committees/${req.params.id}`);
  } catch (err) {
    if (err.code === '23505') req.flash('error', 'এই সদস্য ইতোমধ্যে কমিটিতে আছেন।'); else return next(err);
    res.redirect(`/management-team/committees/${req.params.id}`);
  }
});

router.post('/committees/:committeeId/members/:id/delete', adminOnly, async (req, res, next) => {
  try { await committees.removeMember(req.params.committeeId, req.params.id); req.flash('success', 'কমিটি থেকে সদস্য সরানো হয়েছে।'); res.redirect(`/management-team/committees/${req.params.committeeId}`); }
  catch (err) { next(err); }
});

module.exports = router;
