const express = require('express');
const { requireAuth } = require('../middleware/auth');
const collections = require('../services/collections');
const expenses = require('../services/expenses');
const banks = require('../services/banks');
const reports = require('../services/reports');
const members = require('../services/members');
const operationalReports = require('../services/operational-reports');
const accountabilityReports = require('../services/accountability-reports');
const taskReports = require('../services/task-reports');

const router = express.Router();
router.use(requireAuth);

function range(req) {
  return { from: req.query.from || null, to: req.query.to || null };
}

router.get('/', (req, res) => res.render('reports/index', { title: 'রিপোর্ট কেন্দ্র' }));

router.get('/member-ledger', async (req, res, next) => {
  try { const { from, to } = range(req); const member_id = req.query.member_id || null; res.render('reports/member_ledger', { title: 'সদস্য আর্থিক লেজার', rows: await reports.memberLedger({ member_id, from, to }), memberOptions: await members.options(), member_id, from, to }); }
  catch (err) { next(err); }
});

router.get('/monthly-dues', async (req, res, next) => {
  try { const now = new Date(); const month = /^\d{4}-\d{2}$/.test(req.query.month || '') ? req.query.month : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`; const status = ['all', 'paid', 'due'].includes(req.query.status) ? req.query.status : 'due'; res.render('reports/monthly_dues', { title: 'মাসিক চাঁদা ও বকেয়া রিপোর্ট', data: await reports.monthlyDues({ month, status }), month, status }); }
  catch (err) { next(err); }
});

router.get('/category-summary', async (req, res, next) => {
  try { const { from, to } = range(req); res.render('reports/category_summary', { title: 'খাতভিত্তিক আর্থিক সারাংশ', data: await reports.categorySummary({ from, to }), from, to }); }
  catch (err) { next(err); }
});

router.get('/receipt-books', async (req, res, next) => {
  try { res.render('reports/receipt_books', { title: 'রশিদ বই ব্যবহার রিপোর্ট', rows: await reports.receiptBookUsage() }); }
  catch (err) { next(err); }
});

router.get('/community', async (req, res, next) => {
  try {
    const filters = {
      group: ['directory','occupation','location','reference'].includes(req.query.group) ? req.query.group : 'directory',
      status: ['active','deactive'].includes(req.query.status) ? req.query.status : '',
      gender: ['male','female'].includes(req.query.gender) ? req.query.gender : '',
      monthly: ['yes','no'].includes(req.query.monthly) ? req.query.monthly : '',
      occupation_id: /^\d+$/.test(req.query.occupation_id || '') ? req.query.occupation_id : '',
      village_id: /^\d+$/.test(req.query.village_id || '') ? req.query.village_id : '',
      area_id: /^\d+$/.test(req.query.area_id || '') ? req.query.area_id : '',
    };
    const [data, options] = await Promise.all([reports.communityMembers(filters), reports.communityOptions()]);
    res.render('reports/community', { title: 'কমিউনিটি ও সদস্য বিশ্লেষণ', data, options, filters });
  } catch (err) { next(err); }
});

router.get('/operations', async (req, res, next) => {
  try {
    const type = operationalReports.types.includes(req.query.type) ? req.query.type : 'procurement';
    const from = /^\d{4}-\d{2}-\d{2}$/.test(req.query.from || '') ? req.query.from : null;
    const to = /^\d{4}-\d{2}-\d{2}$/.test(req.query.to || '') ? req.query.to : null;
    const data = await operationalReports.generate(type, { from, to });
    res.render('reports/operations', { title: 'পরিচালনাগত রিপোর্ট', data, type, from, to });
  } catch (err) { next(err); }
});

router.get('/accountability', async (req, res, next) => {
  try {
    const type = accountabilityReports.types.includes(req.query.type) ? req.query.type : 'annual';
    const currentYear = new Date().getFullYear();
    const year = /^20\d{2}$/.test(req.query.year || '') ? Number(req.query.year) : currentYear;
    const status = String(req.query.status || 'open');
    const fund = String(req.query.fund || '');
    const data = await accountabilityReports.generate(type, { year, status, fund });
    res.render('reports/accountability', { title: 'আর্থিক জবাবদিহি রিপোর্ট', type, year, status, fund, data });
  } catch (err) { next(err); }
});

function taskFilters(req) { return { from: /^\d{4}-\d{2}-\d{2}$/.test(req.query.from || '') ? req.query.from : null, to: /^\d{4}-\d{2}-\d{2}$/.test(req.query.to || '') ? req.query.to : null, category: ['general', 'finance', 'facility', 'community', 'event', 'compliance'].includes(req.query.category) ? req.query.category : '', assigned_user_id: /^\d+$/.test(req.query.assigned_user_id || '') ? req.query.assigned_user_id : '' }; }
router.get('/tasks', async (req, res, next) => { try { const filters = taskFilters(req); const [data, users] = await Promise.all([taskReports.generate(filters), dbUsers()]); res.render('reports/tasks', { title: 'কাজ ও কর্মদক্ষতা রিপোর্ট', data, users, filters }); } catch (err) { next(err); } });
router.get('/tasks.csv', async (req, res, next) => { try { const data = await taskReports.generate(taskFilters(req)); res.setHeader('Content-Type', 'text/csv; charset=utf-8'); res.setHeader('Content-Disposition', `attachment; filename="task-report-${new Date().toISOString().slice(0, 10)}.csv"`); res.send(taskReports.csv(data)); } catch (err) { next(err); } });
async function dbUsers() { return require('../config/db')('users').where({ is_active: true }).select('id', 'name', 'role').orderBy('name'); }

router.get('/collection', async (req, res, next) => {
  try {
    const { from, to } = range(req);
    const rows = await collections.list({ from, to, status: 'posted' });
    const total = rows.reduce((s, r) => s + Number(r.amount || 0), 0);
    res.render('reports/collection', { title: 'আদায় রিপোর্ট', rows, total, from, to });
  } catch (err) { next(err); }
});

router.get('/expense', async (req, res, next) => {
  try {
    const { from, to } = range(req);
    const expense_head_id = req.query.expense_head_id || null;
    const rows = await expenses.list({ from, to, expense_head_id, status: 'posted' });
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
