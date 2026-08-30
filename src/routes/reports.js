const express = require('express');
const { requireAuth } = require('../middleware/auth');
const collections = require('../services/collections');
const expenses = require('../services/expenses');
const banks = require('../services/banks');
const reports = require('../services/reports');

const router = express.Router();
router.use(requireAuth);

function range(req) {
  return { from: req.query.from || null, to: req.query.to || null };
}

router.get('/collection', async (req, res, next) => {
  try {
    const { from, to } = range(req);
    const rows = await collections.list({ from, to });
    const total = rows.reduce((s, r) => s + Number(r.amount || 0), 0);
    res.render('reports/collection', { title: 'আদায় রিপোর্ট', rows, total, from, to });
  } catch (err) { next(err); }
});

router.get('/expense', async (req, res, next) => {
  try {
    const { from, to } = range(req);
    const expense_head_id = req.query.expense_head_id || null;
    const rows = await expenses.list({ from, to, expense_head_id });
    const total = rows.reduce((s, r) => s + Number(r.amount || 0), 0);
    res.render('reports/expense', {
      title: 'খরচ রিপোর্ট', rows, total, from, to,
      heads: await expenses.heads.all(), expense_head_id,
    });
  } catch (err) { next(err); }
});

router.get('/loss-profit', async (req, res, next) => {
  try {
    const { from, to } = range(req);
    const data = await reports.lossAndProfit({ from, to });
    res.render('reports/loss_profit', { title: 'লাভ ও ক্ষতি', data, from, to });
  } catch (err) { next(err); }
});

router.get('/bank-statement', async (req, res, next) => {
  try {
    const { from, to } = range(req);
    const bank_id = req.query.bank_id || null;
    const data = await reports.bankStatement({ from, to, bank_id });
    res.render('reports/bank_statement', { title: 'ব্যাংক স্টেটমেন্ট', data, from, to, bank_id, bankList: await banks.banks.all() });
  } catch (err) { next(err); }
});

module.exports = router;
