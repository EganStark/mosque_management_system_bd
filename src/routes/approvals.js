const express = require('express');
const { requireAuth, adminOnly } = require('../middleware/auth');
const approvals = require('../services/approvals');

const router = express.Router();
router.use(requireAuth, adminOnly);
function filters(req) {
  return {
    type: ['expenses', 'loans', 'welfare', 'welfare-releases', 'procurement', 'supplier-payments', 'maintenance-completions', 'payroll-payments', 'treasury-transfers', 'documents', 'donations'].includes(req.query.type) ? req.query.type : '',
    decision: ['approved', 'rejected'].includes(req.query.decision) ? req.query.decision : '',
    from: /^\d{4}-\d{2}-\d{2}$/.test(req.query.from || '') ? req.query.from : '',
    to: /^\d{4}-\d{2}-\d{2}$/.test(req.query.to || '') ? req.query.to : '',
  };
}

router.get('/history/export.csv', async (req, res, next) => {
  try {
    const report = await approvals.history(filters(req));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="approval-history.csv"');
    res.send(`\uFEFF${approvals.historyCsv(report.rows)}`);
  } catch (error) { next(error); }
});

router.get('/history', async (req, res, next) => {
  try {
    const selected = filters(req);
    res.render('approvals/history', { title: 'অনুমোদন জবাবদিহি', report: await approvals.history(selected), filters: selected });
  } catch (error) { next(error); }
});

router.get('/', async (req, res, next) => {
  try {
    res.render('approvals/index', { title: 'অনুমোদন ইনবক্স', queue: await approvals.get() });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
