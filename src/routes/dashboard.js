const express = require('express');
const { requireAuth } = require('../middleware/auth');
const reports = require('../services/reports');
const members = require('../services/members');
const monthlyPayments = require('../services/monthly-payments');
const assets = require('../services/assets');
const treasury = require('../services/treasury');
const dashboardOperations = require('../services/dashboard-operations');
const executiveDashboard = require('../services/executive-dashboard');
const userWorkspace = require('../services/user-workspace');
const dashboardPreferences = require('../services/dashboard-preferences');
const { body, validationResult } = require('express-validator');
const { adminOnly } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, (req, res) => res.redirect('/dashboard'));

router.get('/dashboard', requireAuth, async (req, res, next) => {
  try {
    const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(String(req.query.month || '')) ? req.query.month : undefined;
    const [stats, memberCounts, monthlySummary, assetSummary, treasurySummary, operations, executive, workspace, dashboardPrefs] = await Promise.all([reports.dashboard(month), members.counts(), monthlyPayments.dashboardSummary(month), assets.summary(), treasury.overview(), dashboardOperations.get(req.session.user.role, req.session.user.id), executiveDashboard.get(month), userWorkspace.summary(req.session.user), dashboardPreferences.get(req.session.user.id)]);
    res.render('dashboard/index', { title: 'ড্যাশবোর্ড', stats, memberCounts, monthlySummary, assetSummary, treasurySummary, operations, executive, workspace, dashboardPrefs });
  } catch (err) {
    next(err);
  }
});

router.post('/dashboard/preferences', requireAuth, async (req, res) => { try { await dashboardPreferences.saveLayout(req.session.user.id, req.body.visible_widgets || [], req.body.widget_order); req.flash('success', 'আপনার ড্যাশবোর্ড বিন্যাস সংরক্ষণ হয়েছে।'); } catch (err) { req.flash('error', err.message); } res.redirect('/dashboard'); });

router.post('/dashboard/targets', requireAuth, adminOnly, body('month').matches(/^\d{4}-\d{2}$/), body('collection_target').isFloat({ min: 0 }), body('expense_budget').isFloat({ min: 0 }), async (req, res) => {
  try {
    if (!validationResult(req).isEmpty()) throw new Error('মাস, আদায়ের লক্ষ্য ও ব্যয় বাজেট সঠিকভাবে দিন।');
    await executiveDashboard.saveTarget(req.body.month, req.body, req.session.user.id);
    req.flash('success', 'মাসিক ব্যবস্থাপনা লক্ষ্য সংরক্ষণ হয়েছে।');
  } catch (err) { req.flash('error', err.message); }
  res.redirect('/dashboard');
});

router.get('/dashboard/executive-summary', requireAuth, async (req, res, next) => {
  try { res.render('dashboard/executive-summary', { layout: 'layout_blank', title: 'নির্বাহী সারসংক্ষেপ', executive: await executiveDashboard.get(req.query.month) }); } catch (err) { next(err); }
});

module.exports = router;
