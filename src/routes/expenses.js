const express = require('express');
const { body, validationResult } = require('express-validator');
const { requireAuth, canWrite, adminOnly } = require('../middleware/auth');
const expenses = require('../services/expenses');
const banks = require('../services/banks');
const mobileWallets = require('../services/mobile-wallets');

const router = express.Router();
router.use(requireAuth);

// --- Expense Heads ---
router.get('/heads', canWrite, async (req, res, next) => {
  try {
    res.render('expenses/heads', { title: 'খরচের খাত', rows: await expenses.heads.all() });
  } catch (err) { next(err); }
});

router.post('/heads', adminOnly, async (req, res, next) => {
  try {
    await expenses.heads.create({ name: req.body.name, voucher_no: req.body.voucher_no || null });
    req.flash('success', 'খরচের খাত যুক্ত হয়েছে।');
    res.redirect('/expenses/heads');
  } catch (err) { next(err); }
});

router.post('/heads/:id', adminOnly, async (req, res, next) => {
  try {
    await expenses.heads.update(req.params.id, { name: req.body.name, voucher_no: req.body.voucher_no || null });
    req.flash('success', 'হালনাগাদ হয়েছে।');
    res.redirect('/expenses/heads');
  } catch (err) { next(err); }
});

router.post('/heads/:id/delete', adminOnly, async (req, res, next) => {
  try {
    await expenses.heads.remove(req.params.id);
    req.flash('success', 'মুছে ফেলা হয়েছে।');
    res.redirect('/expenses/heads');
  } catch (err) {
    req.flash('error', 'মুছে ফেলা যায়নি।');
    res.redirect('/expenses/heads');
  }
});

// --- Expenses ---
router.get('/', async (req, res, next) => {
  try {
    res.render('expenses/list', { title: 'খরচ ব্যবস্থাপনা', rows: await expenses.list() });
  } catch (err) { next(err); }
});

router.get('/new', canWrite, async (req, res, next) => {
  try {
    res.render('expenses/add', { title: 'নতুন খরচ', heads: await expenses.heads.all(), banks: await banks.banks.active(), wallets: await mobileWallets.wallets.active() });
  } catch (err) { next(err); }
});

router.post(
  '/',
  canWrite,
  body('amount').isFloat({ gt: 0 }),
  body('date').notEmpty(),
  body('payment_method').isIn(['cash', 'bank', 'mobile_banking']),
  body('bank_id').optional({ checkFalsy: true }).isInt({ min: 1 }),
  body('mobile_wallet_id').optional({ checkFalsy: true }).isInt({ min: 1 }),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        req.flash('error', 'পরিমাণ ও তারিখ সঠিকভাবে দিন।');
        return res.redirect('/expenses/new');
      }
      const b = req.body;
      await expenses.create({
        expense_head_id: b.expense_head_id || null,
        purpose: b.purpose || null,
        unit: b.unit || null,
        rate: b.rate || null,
        amount: b.amount,
        date: b.date,
        voucher_no: b.voucher_no || null,
        payee: b.payee || null,
        payment_method: b.payment_method,
        bank_id: b.payment_method === 'bank' ? (b.bank_id || null) : null,
        mobile_wallet_id: b.payment_method === 'mobile_banking' ? (b.mobile_wallet_id || null) : null,
        transaction_reference: b.transaction_reference || null,
        remarks: b.remarks || null,
        created_by: req.session.user.id,
        status: 'pending',
        submitted_by: req.session.user.id,
      });
      req.flash('success', 'খরচটি অনুমোদনের জন্য জমা হয়েছে; অনুমোদনের আগে হিসাবে প্রভাব ফেলবে না।');
      res.redirect('/expenses');
    } catch (err) { next(err); }
  }
);

router.post(
  '/:id/decision',
  adminOnly,
  body('decision').isIn(['approve', 'reject']),
  async (req, res) => {
    try {
      if (!validationResult(req).isEmpty()) throw new Error('সঠিক সিদ্ধান্ত নির্বাচন করুন।');
      await expenses.decide(req.params.id, req.body.decision, req.body.decision_notes, req.session.user.id, { budget_override_reason: req.body.budget_override_reason });
      req.flash('success', req.body.decision === 'approve'
        ? 'খরচ অনুমোদিত হয়ে হিসাবে যুক্ত হয়েছে।'
        : 'খরচের অনুরোধ প্রত্যাখ্যান হয়েছে।');
    } catch (err) {
      req.flash('error', err.message);
    }
    res.redirect('/expenses');
  },
);

router.get('/:id/voucher', async (req, res, next) => {
  try {
    const expense = await expenses.findFull(req.params.id);
    if (!expense) return res.status(404).render('error', { title: 'পাওয়া যায়নি', status: 404, message: 'খরচের রেকর্ড পাওয়া যায়নি।' });
    res.render('expenses/voucher', { title: `ভাউচার ${expense.voucher_no}`, expense });
  } catch (err) { next(err); }
});

router.post('/:id/cancel', adminOnly, body('cancellation_reason').trim().notEmpty(), async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash('error', 'বাতিল করার কারণ লিখুন।');
      return res.redirect('/expenses');
    }
    await expenses.cancel(req.params.id, { cancelled_by: req.session.user.id, cancellation_reason: req.body.cancellation_reason });
    req.flash('success', 'খরচের রেকর্ড বাতিল করা হয়েছে।');
    res.redirect('/expenses');
  } catch (err) { next(err); }
});

module.exports = router;
