const express = require('express');
const { body, validationResult } = require('express-validator');
const { requireAuth, canWrite } = require('../middleware/auth');
const expenses = require('../services/expenses');

const router = express.Router();
router.use(requireAuth);

// --- Expense Heads ---
router.get('/heads', canWrite, async (req, res, next) => {
  try {
    res.render('expenses/heads', { title: 'খরচের খাত', rows: await expenses.heads.all() });
  } catch (err) { next(err); }
});

router.post('/heads', canWrite, async (req, res, next) => {
  try {
    await expenses.heads.create({ name: req.body.name, voucher_no: req.body.voucher_no || null });
    req.flash('success', 'খরচের খাত যুক্ত হয়েছে।');
    res.redirect('/expenses/heads');
  } catch (err) { next(err); }
});

router.post('/heads/:id', canWrite, async (req, res, next) => {
  try {
    await expenses.heads.update(req.params.id, { name: req.body.name, voucher_no: req.body.voucher_no || null });
    req.flash('success', 'হালনাগাদ হয়েছে।');
    res.redirect('/expenses/heads');
  } catch (err) { next(err); }
});

router.post('/heads/:id/delete', canWrite, async (req, res, next) => {
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
    res.render('expenses/add', { title: 'নতুন খরচ', heads: await expenses.heads.all() });
  } catch (err) { next(err); }
});

router.post(
  '/',
  canWrite,
  body('amount').isFloat({ gt: 0 }),
  body('date').notEmpty(),
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
        created_by: req.session.user.id,
      });
      req.flash('success', 'খরচ যুক্ত হয়েছে।');
      res.redirect('/expenses');
    } catch (err) { next(err); }
  }
);

router.post('/:id/delete', canWrite, async (req, res, next) => {
  try {
    await expenses.remove(req.params.id);
    req.flash('success', 'মুছে ফেলা হয়েছে।');
    res.redirect('/expenses');
  } catch (err) { next(err); }
});

module.exports = router;
