const express = require('express');
const { body, validationResult } = require('express-validator');
const { requireAuth, canWrite, adminOnly } = require('../middleware/auth');
const treasury = require('../services/treasury');
const banks = require('../services/banks');
const mobileWallets = require('../services/mobile-wallets');

const router = express.Router();
router.use(requireAuth);
router.get('/', async (req, res, next) => { try { res.render('treasury/index', { title: 'ক্যাশ ও ব্যাংক', overview: await treasury.overview(), rows: await treasury.transfers(), reconciliations: await treasury.reconciliations() }); } catch (err) { next(err); } });
router.post('/wallets', adminOnly, body('provider').isIn(['bkash', 'nagad', 'rocket', 'other']), body('name').trim().notEmpty(), body('opening_balance').optional({ checkFalsy: true }).isFloat({ min: 0 }), body('opening_balance_date').optional({ checkFalsy: true }).isISO8601(), async (req, res) => {
  try {
    if (!validationResult(req).isEmpty()) throw new Error('সঠিক ওয়ালেট তথ্য দিন।');
    await mobileWallets.wallets.create(req.body);
    req.flash('success', 'মোবাইল ওয়ালেট যোগ হয়েছে।');
  } catch (err) { req.flash('error', err.message); }
  res.redirect('/treasury');
});
router.post('/wallets/:id', adminOnly, body('provider').isIn(['bkash', 'nagad', 'rocket', 'other']), body('name').trim().notEmpty(), body('opening_balance').optional({ checkFalsy: true }).isFloat({ min: 0 }), body('opening_balance_date').optional({ checkFalsy: true }).isISO8601(), async (req, res) => {
  try {
    if (!validationResult(req).isEmpty()) throw new Error('সঠিক ওয়ালেট তথ্য দিন।');
    await mobileWallets.wallets.update(req.params.id, req.body);
    req.flash('success', 'মোবাইল ওয়ালেট হালনাগাদ হয়েছে।');
  } catch (err) { req.flash('error', err.message); }
  res.redirect('/treasury');
});
router.post('/wallets/:id/status', adminOnly, body('is_active').isIn(['true', 'false']), async (req, res) => {
  try {
    if (!validationResult(req).isEmpty()) throw new Error('সঠিক অবস্থা নির্বাচন করুন।');
    const active = req.body.is_active === 'true';
    await mobileWallets.wallets.setActive(req.params.id, active);
    req.flash('success', active ? 'মোবাইল ওয়ালেট পুনরায় সক্রিয় হয়েছে।' : 'মোবাইল ওয়ালেট নিষ্ক্রিয় হয়েছে; ইতিহাস সংরক্ষিত আছে।');
  } catch (err) { req.flash('error', err.message); }
  res.redirect('/treasury');
});
router.get('/transfer', adminOnly, async (req, res, next) => { try { const [bankList, walletList, transferRequests] = await Promise.all([banks.banks.all(), mobileWallets.wallets.active(), treasury.transferRequests()]); res.render('treasury/transfer', { title: 'তহবিল স্থানান্তর', bankList, walletList, transferRequests }); } catch (err) { next(err); } });
router.post('/transfer', adminOnly, body('type').isIn(['cash_to_bank', 'bank_to_cash', 'bank_to_bank', 'cash_to_wallet', 'wallet_to_cash', 'bank_to_wallet', 'wallet_to_bank', 'wallet_to_wallet']), body('amount').isFloat({ gt: 0 }), body('date').isISO8601(), body('from_bank_id').optional({ checkFalsy: true }).isInt({ min: 1 }), body('to_bank_id').optional({ checkFalsy: true }).isInt({ min: 1 }), body('from_mobile_wallet_id').optional({ checkFalsy: true }).isInt({ min: 1 }), body('to_mobile_wallet_id').optional({ checkFalsy: true }).isInt({ min: 1 }), async (req, res, next) => {
  try {
    if (!validationResult(req).isEmpty()) { req.flash('error', 'স্থানান্তরের তথ্য সঠিকভাবে দিন।'); return res.redirect('/treasury/transfer'); }
    await treasury.requestTransfer(req.body, req.session.user.id);
    req.flash('success', 'তহবিল স্থানান্তর রেকর্ড হয়েছে।'); res.redirect('/treasury');
  } catch (err) { req.flash('error', err.message === 'Insufficient cash balance' ? 'পর্যাপ্ত নগদ অবশিষ্ট নেই।' : err.message === 'Insufficient bank balance' ? 'ব্যাংক হিসাবে পর্যাপ্ত ব্যালেন্স নেই।' : err.message); res.redirect('/treasury/transfer'); }
});
router.post('/transfer-requests/:id/decision', adminOnly, body('decision').isIn(['approved', 'rejected']), async (req, res) => { try { if (!validationResult(req).isEmpty()) throw new Error('Choose a valid transfer decision'); await treasury.decideTransfer(req.params.id, req.body.decision, req.body.decision_notes, req.session.user.id); req.flash('success', req.body.decision === 'approved' ? 'Transfer approved and posted.' : 'Transfer request rejected.'); } catch (err) { req.flash('error', err.message); } res.redirect('/treasury/transfer'); });
router.post('/transfers/:id/cancel', adminOnly, body('cancellation_reason').trim().notEmpty(), async (req, res, next) => { try { if (!validationResult(req).isEmpty()) { req.flash('error', 'বাতিলের কারণ লিখুন।'); return res.redirect('/treasury'); } await treasury.cancelTransfer(req.params.id, { cancelled_by: req.session.user.id, cancellation_reason: req.body.cancellation_reason }); req.flash('success', 'স্থানান্তর বাতিল হয়েছে।'); res.redirect('/treasury'); } catch (err) { next(err); } });
router.post('/reconcile', adminOnly, body('bank_id').isInt(), body('statement_date').isISO8601(), body('statement_balance').isFloat(), async (req, res, next) => { try { if (!validationResult(req).isEmpty()) { req.flash('error', 'রিকনসিলিয়েশন তথ্য সঠিকভাবে দিন।'); return res.redirect('/treasury'); } await treasury.reconcile({ ...req.body, created_by: req.session.user.id }); req.flash('success', 'ব্যাংক স্টেটমেন্ট মিল সংরক্ষণ হয়েছে।'); res.redirect('/treasury'); } catch (err) { next(err); } });
router.get('/cashbook', async (req, res, next) => { try { const from = req.query.from || null, to = req.query.to || null; res.render('treasury/cashbook', { title: 'ক্যাশবুক', rows: await treasury.cashbook({ from, to }), from, to }); } catch (err) { next(err); } });
module.exports = router;
