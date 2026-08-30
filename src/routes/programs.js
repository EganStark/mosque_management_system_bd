const express = require('express');
const { body, validationResult } = require('express-validator');
const { requireAuth, canWrite } = require('../middleware/auth');
const programs = require('../services/programs');
const members = require('../services/members');

const router = express.Router();
router.use(requireAuth);
const today = () => new Date().toISOString().slice(0, 10);

router.get('/', async (req, res, next) => { try { const [rows, summary] = await Promise.all([programs.list(), programs.summary()]); res.render('programs/list', { title: 'প্রোগ্রাম ও শিক্ষা', rows, summary }); } catch (err) { next(err); } });
router.get('/new', canWrite, (req, res) => res.render('programs/form', { title: 'নতুন প্রোগ্রাম' }));
router.post('/', canWrite, body('name').trim().notEmpty(), body('category').isIn(['education', 'children', 'women', 'volunteer', 'community', 'other']), async (req, res, next) => {
  try { if (!validationResult(req).isEmpty()) { req.flash('error', 'প্রোগ্রামের নাম ও ধরন দিন।'); return res.redirect('/programs/new'); } const program = await programs.create(req.body, req.session.user.id); req.flash('success', 'প্রোগ্রাম তৈরি হয়েছে।'); res.redirect(`/programs/${program.id}`); } catch (err) { next(err); }
});
router.get('/:id', async (req, res, next) => { try { const program = await programs.find(req.params.id); if (!program) return res.redirect('/programs'); res.render('programs/view', { title: program.name, program, memberOptions: await members.options() }); } catch (err) { next(err); } });
router.post('/:id/enroll', canWrite, body('member_id').optional({ checkFalsy: true }).isInt(), async (req, res) => {
  try { if (!req.body.member_id && !String(req.body.participant_name || '').trim()) throw new Error('সদস্য নির্বাচন করুন অথবা অংশগ্রহণকারীর নাম লিখুন'); await programs.enroll(req.params.id, req.body); req.flash('success', 'অংশগ্রহণকারী যুক্ত হয়েছে।'); } catch (err) { req.flash('error', err.code === '23505' ? 'এই সদস্য আগে থেকেই প্রোগ্রামে আছেন।' : err.message); } res.redirect(`/programs/${req.params.id}`);
});
router.get('/:id/attendance', async (req, res, next) => { try { const date = /^\d{4}-\d{2}-\d{2}$/.test(req.query.date || '') ? req.query.date : today(); const program = await programs.find(req.params.id); if (!program) return res.redirect('/programs'); res.render('programs/attendance', { title: 'উপস্থিতি', program, date, rows: await programs.attendanceSheet(req.params.id, date) }); } catch (err) { next(err); } });
router.post('/:id/attendance', canWrite, body('date').isISO8601(), async (req, res) => {
  try { const rows = Object.keys(req.body).filter((key) => key.startsWith('status_')).map((key) => { const id = key.slice(7); return { enrollment_id: Number(id), status: ['present', 'absent', 'late', 'excused'].includes(req.body[key]) ? req.body[key] : 'absent', remarks: req.body[`remarks_${id}`] || null }; }); await programs.saveAttendance(req.params.id, req.body.date, rows, req.session.user.id); req.flash('success', 'উপস্থিতি সংরক্ষণ হয়েছে।'); } catch (err) { req.flash('error', err.message); } res.redirect(`/programs/${req.params.id}/attendance?date=${encodeURIComponent(req.body.date || today())}`);
});

module.exports = router;
