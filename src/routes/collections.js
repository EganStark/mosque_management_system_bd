const express = require('express');
const { body, validationResult } = require('express-validator');
const { requireAuth, canWrite, adminOnly } = require('../middleware/auth');
const collections = require('../services/collections');
const members = require('../services/members');
const books = require('../services/books');
const banks = require('../services/banks');
const mobileWallets = require('../services/mobile-wallets');

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    res.render('collections/list', { title: 'আদায় ব্যবস্থাপনা', rows: await collections.list() });
  } catch (err) { next(err); }
});

router.get('/new', canWrite, async (req, res, next) => {
  try {
    res.render('collections/add', {
      title: 'নতুন আদায়',
      memberOptions: await members.options(),
      activeBooks: await books.numbers.active(),
      categories: await collections.categories.all(),
      banks: await banks.banks.active(),
      wallets: await mobileWallets.wallets.active(),
    });
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
        req.flash('error', 'সদস্য, পরিমাণ ও তারিখ সঠিকভাবে দিন।');
        return res.redirect('/collections/new');
      }
      const b = req.body;
      await collections.create({
        member_id: b.member_id || null,
        payer_name: b.payer_name || null,
        collection_category_id: b.collection_category_id || null,
        purpose: b.purpose || null,
        account: b.account || null,
        book_number_id: b.book_number_id || null,
        receipt_no: b.receipt_no || null,
        payment_method: b.payment_method,
        bank_id: b.payment_method === 'bank' ? (b.bank_id || null) : null,
        mobile_wallet_id: b.payment_method === 'mobile_banking' ? (b.mobile_wallet_id || null) : null,
        transaction_reference: b.transaction_reference || null,
        remarks: b.remarks || null,
        amount: b.amount,
        date: b.date,
        created_by: req.session.user.id,
      });
      req.flash('success', 'আদায় যুক্ত হয়েছে।');
      res.redirect('/collections');
    } catch (err) { next(err); }
  }
);

router.get('/:id/receipt', async (req, res, next) => {
  try {
    const collection = await collections.findFull(req.params.id);
    if (!collection) return res.status(404).render('error', { title: 'পাওয়া যায়নি', status: 404, message: 'আদায়ের রেকর্ড পাওয়া যায়নি।' });
    res.render('collections/receipt', { title: `রশিদ ${collection.receipt_no}`, collection });
  } catch (err) { next(err); }
});

router.post('/:id/cancel', adminOnly, body('cancellation_reason').trim().notEmpty(), async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash('error', 'বাতিল করার কারণ লিখুন।');
      return res.redirect('/collections');
    }
    await collections.cancel(req.params.id, { cancelled_by: req.session.user.id, cancellation_reason: req.body.cancellation_reason });
    req.flash('success', 'আদায়ের রেকর্ড বাতিল করা হয়েছে।');
    res.redirect('/collections');
  } catch (err) { next(err); }
});

module.exports = router;
