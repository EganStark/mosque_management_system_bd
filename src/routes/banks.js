const express = require('express');
const { body, validationResult } = require('express-validator');
const { requireAuth, canWrite, adminOnly } = require('../middleware/auth');
const banks = require('../services/banks');

const router = express.Router();
router.use(requireAuth);

// --- Bank setup (admin) ---
router.get('/setup', adminOnly, async (req, res, next) => {
  try {
    res.render('banks/setup', { title: 'ব্যাংক সেটআপ', rows: await banks.banks.all() });
  } catch (err) { next(err); }
});

router.post('/setup', adminOnly, body('name').trim().notEmpty(), body('opening_balance').optional({ checkFalsy: true }).isFloat({ min: 0 }), body('opening_balance_date').optional({ checkFalsy: true }).isISO8601(), async (req, res) => {
  try {
    if (!validationResult(req).isEmpty()) throw new Error('ব্যাংকের তথ্য সঠিকভাবে দিন।');
    await banks.banks.create({ name: req.body.name, account_number: req.body.account_number || null, branch_name: req.body.branch_name || null, opening_balance: req.body.opening_balance || 0, opening_balance_date: req.body.opening_balance_date || null });
    req.flash('success', 'ব্যাংক যুক্ত হয়েছে।');
  } catch (err) { req.flash('error', err.message); }
  res.redirect('/banks/setup');
});

router.post('/setup/:id', adminOnly, body('name').trim().notEmpty(), body('opening_balance').optional({ checkFalsy: true }).isFloat({ min: 0 }), body('opening_balance_date').optional({ checkFalsy: true }).isISO8601(), async (req, res) => {
  try {
    if (!validationResult(req).isEmpty()) throw new Error('ব্যাংকের তথ্য সঠিকভাবে দিন।');
    await banks.banks.update(req.params.id, { name: req.body.name, account_number: req.body.account_number || null, branch_name: req.body.branch_name || null, opening_balance: req.body.opening_balance || 0, opening_balance_date: req.body.opening_balance_date || null });
    req.flash('success', 'হালনাগাদ হয়েছে।');
  } catch (err) { req.flash('error', err.message); }
  res.redirect('/banks/setup');
});

router.post('/setup/:id/status', adminOnly, body('is_active').isIn(['true', 'false']), async (req, res) => {
  try {
    if (!validationResult(req).isEmpty()) throw new Error('সঠিক অবস্থা নির্বাচন করুন।');
    const active = req.body.is_active === 'true';
    await banks.banks.setActive(req.params.id, active);
    req.flash('success', active ? 'ব্যাংক হিসাবটি পুনরায় সক্রিয় হয়েছে।' : 'ব্যাংক হিসাবটি নিষ্ক্রিয় হয়েছে; ইতিহাস সংরক্ষিত আছে।');
  } catch (err) {
    req.flash('error', err.message);
  }
  res.redirect('/banks/setup');
});

// --- Transactions ledger ---
router.get('/', async (req, res, next) => {
  try {
    res.render('banks/list', { title: 'ব্যাংক লেনদেন', rows: await banks.transactions.list() });
  } catch (err) { next(err); }
});

// --- Deposit / Withdraw form (type via query: deposit | withdraw) ---
router.get('/transaction', canWrite, async (req, res, next) => {
  try {
    const type = req.query.type === 'withdraw' ? 'withdraw' : 'deposit';
    res.render('banks/transaction', { title: type === 'deposit' ? 'ব্যাংক জমা' : 'ব্যাংক উত্তোলন', type, bankList: await banks.banks.all() });
  } catch (err) { next(err); }
});

router.post(
  '/transaction',
  canWrite,
  body('bank_id').notEmpty(),
  body('amount').isFloat({ gt: 0 }),
  body('date').isISO8601(),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        req.flash('error', 'ব্যাংক, পরিমাণ ও তারিখ সঠিকভাবে দিন।');
        return res.redirect('/banks/transaction?type=' + (req.body.type || 'deposit'));
      }
      const b = req.body;
      await banks.transactions.create({
        bank_id: b.bank_id,
        type: b.type === 'withdraw' ? 'withdraw' : 'deposit',
        amount: b.amount,
        cheque_number: b.cheque_number || null,
        payment_method: b.payment_method || null,
        remarks: b.remarks || null,
        date: b.date,
        created_by: req.session.user.id,
      });
      req.flash('success', 'লেনদেন যুক্ত হয়েছে।');
      res.redirect('/banks');
    } catch (err) { next(err); }
  }
);

router.post('/:id/cancel', adminOnly, body('cancellation_reason').trim().notEmpty(), async (req, res) => {
  try {
    if (!validationResult(req).isEmpty()) throw new Error('বাতিলের কারণ লিখুন।');
    await banks.transactions.cancel(req.params.id, {
      cancelled_by: req.session.user.id,
      cancellation_reason: req.body.cancellation_reason,
    });
    req.flash('success', 'ব্যাংক লেনদেনটি অডিট ইতিহাস রেখে বাতিল হয়েছে।');
  } catch (err) { req.flash('error', err.message); }
  res.redirect('/banks');
});

module.exports = router;
