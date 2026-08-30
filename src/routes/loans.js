const express = require('express');
const { body, validationResult } = require('express-validator');
const { requireAuth, canWrite, adminOnly } = require('../middleware/auth');
const loans = require('../services/loans');
const members = require('../services/members');
const db = require('../config/db');
const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res, next) => { try {
  await loans.refreshOverdue();
  const [rows, summary, memberOptions, banks, mobileWallets] = await Promise.all([loans.list({ status: req.query.status }), loans.summary(), members.options(), db('banks').where({ is_active: true }).orderBy('name'), db('mobile_wallets').where({ is_active: true }).orderBy(['provider', 'name'])]);
  res.render('loans/list', { title: 'ঋণ ও কিস্তি', rows, summary, memberOptions, banks, mobileWallets, status: req.query.status || '' });
} catch (err) { next(err); } });

router.post('/', canWrite,
  body('borrower_name').trim().notEmpty(), body('purpose').trim().notEmpty(), body('principal_amount').isFloat({ gt: 0 }),
  body('issue_date').isISO8601(), body('payment_method').isIn(['cash', 'bank', 'mobile_banking']),
  body('bank_id').optional({ checkFalsy: true }).isInt({ min: 1 }),
  body('mobile_wallet_id').optional({ checkFalsy: true }).isInt({ min: 1 }),
  async (req, res) => { try {
    if (!validationResult(req).isEmpty()) throw new Error('প্রয়োজনীয় ঋণ তথ্য সঠিকভাবে দিন');
    const item = await loans.submit(req.body, req.session.user.id);
    req.flash('success', 'ঋণের আবেদন অনুমোদনের জন্য জমা হয়েছে; অনুমোদনের আগে অর্থ ছাড় হবে না।'); return res.redirect(`/loans/${item.id}`);
  } catch (err) { req.flash('error', err.message); return res.redirect('/loans'); } });

router.get('/:id', async (req, res, next) => { try {
  const [item, banks, mobileWallets] = await Promise.all([loans.find(req.params.id), db('banks').where({ is_active: true }).orderBy('name'), db('mobile_wallets').where({ is_active: true }).orderBy(['provider', 'name'])]);
  if (!item) return res.redirect('/loans');
  return res.render('loans/view', { title: item.loan_no, item, banks, mobileWallets });
} catch (err) { return next(err); } });

router.post('/:id/decision', adminOnly, body('decision').isIn(['approve', 'reject']), async (req, res) => {
  try {
    if (!validationResult(req).isEmpty()) throw new Error('সঠিক সিদ্ধান্ত নির্বাচন করুন');
    await loans.decide(req.params.id, req.body.decision, req.body.decision_notes, req.session.user.id);
    req.flash('success', req.body.decision === 'approve'
      ? 'ঋণ অনুমোদিত হয়েছে এবং তহবিল থেকে অর্থ ছাড় হয়েছে।'
      : 'ঋণের আবেদন প্রত্যাখ্যান হয়েছে।');
  } catch (err) {
    req.flash('error', err.message);
  }
  return res.redirect(`/loans/${req.params.id}`);
});

router.post('/:id/repayments', canWrite, body('amount').isFloat({ gt: 0 }), body('payment_date').isISO8601(), body('payment_method').isIn(['cash', 'bank', 'mobile_banking']), body('bank_id').optional({ checkFalsy: true }).isInt({ min: 1 }), body('mobile_wallet_id').optional({ checkFalsy: true }).isInt({ min: 1 }), async (req, res) => { try {
  if (!validationResult(req).isEmpty()) throw new Error('কিস্তির তথ্য সঠিকভাবে দিন');
  await loans.repay(req.params.id, req.body, req.session.user.id); req.flash('success', 'কিস্তি গ্রহণ ও বকেয়া হালনাগাদ হয়েছে।');
} catch (err) { req.flash('error', err.message); }
  return res.redirect(`/loans/${req.params.id}`);
});

router.post('/:id/cancel', adminOnly, body('cancellation_reason').trim().notEmpty(), async (req, res) => {
  try {
    if (!validationResult(req).isEmpty()) throw new Error('বাতিলের কারণ লিখুন');
    await loans.cancel(req.params.id, req.body.cancellation_reason, req.session.user.id);
    req.flash('success', 'ঋণটি বাতিল হয়েছে এবং তহবিলের ব্যালেন্স পুনরুদ্ধার হয়েছে।');
  } catch (err) {
    req.flash('error', err.message);
  }
  return res.redirect(`/loans/${req.params.id}`);
});

router.post('/:loanId/repayments/:repaymentId/cancel', adminOnly, body('cancellation_reason').trim().notEmpty(), async (req, res) => {
  try {
    if (!validationResult(req).isEmpty()) throw new Error('বাতিলের কারণ লিখুন');
    await loans.cancelRepayment(req.params.repaymentId, req.body.cancellation_reason, req.session.user.id);
    req.flash('success', 'ভুল কিস্তি বাতিল হয়েছে এবং ঋণ ও তহবিলের হিসাব হালনাগাদ হয়েছে।');
  } catch (err) {
    req.flash('error', err.message);
  }
  return res.redirect(`/loans/${req.params.loanId}`);
});

module.exports = router;
