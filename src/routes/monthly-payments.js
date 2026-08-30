const express = require('express');
const { body, validationResult } = require('express-validator');
const { requireAuth, canWrite, adminOnly } = require('../middleware/auth');
const monthlyPayments = require('../services/monthly-payments');
const banks = require('../services/banks');
const mobileWallets = require('../services/mobile-wallets');

const router = express.Router();
router.use(requireAuth);

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

router.get('/', async (req, res, next) => {
  try {
    const month = /^\d{4}-\d{2}$/.test(req.query.month || '') ? req.query.month : currentMonth();
    const [rows, summary] = await Promise.all([monthlyPayments.list(month), monthlyPayments.summary(month)]);
    res.render('monthly-payments/index', { title: 'মাসিক চাঁদা', month, rows, summary });
  } catch (err) { next(err); }
});

router.post('/generate', adminOnly, body('month').matches(/^\d{4}-\d{2}$/), async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash('error', 'সঠিক মাস নির্বাচন করুন।');
      return res.redirect('/monthly-payments');
    }
    const count = await monthlyPayments.generate(req.body.month, req.session.user.id);
    req.flash('success', count ? `${count}টি নতুন মাসিক বিল তৈরি হয়েছে।` : 'এই মাসের সব বিল আগে থেকেই তৈরি আছে।');
    res.redirect(`/monthly-payments?month=${req.body.month}`);
  } catch (err) { next(err); }
});

router.get('/:id/pay', canWrite, async (req, res, next) => {
  try {
    const [bill, paymentRows, bankRows, walletRows] = await Promise.all([
      monthlyPayments.find(req.params.id), monthlyPayments.paymentsForBill(req.params.id), banks.banks.active(), mobileWallets.wallets.active(),
    ]);
    if (!bill) return res.status(404).render('error', { title: 'পাওয়া যায়নি', status: 404, message: 'মাসিক বিলটি পাওয়া যায়নি।' });
    res.render('monthly-payments/pay', { title: 'মাসিক চাঁদা গ্রহণ', bill, paymentRows, banks: bankRows, wallets: walletRows });
  } catch (err) { next(err); }
});

router.post('/:id/pay', canWrite,
  body('amount').isFloat({ gt: 0 }), body('payment_date').isISO8601(),
  body('payment_method').isIn(['cash', 'bank', 'mobile_banking']),
  body('bank_id').optional({ checkFalsy: true }).isInt({ min: 1 }),
  body('mobile_wallet_id').optional({ checkFalsy: true }).isInt({ min: 1 }),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        req.flash('error', 'পেমেন্টের তথ্য সঠিকভাবে দিন।');
        return res.redirect(`/monthly-payments/${req.params.id}/pay`);
      }
      await monthlyPayments.recordPayment(req.params.id, req.body, req.session.user.id);
      req.flash('success', 'মাসিক চাঁদা গ্রহণ ও আদায় হিসাবে সংরক্ষণ হয়েছে।');
      res.redirect(`/monthly-payments/${req.params.id}/pay`);
    } catch (err) {
      req.flash('error', err.message === 'Payment must be within the outstanding amount' ? 'পরিশোধের পরিমাণ বকেয়ার চেয়ে বেশি হতে পারবে না।' : err.message);
      res.redirect(`/monthly-payments/${req.params.id}/pay`);
    }
  }
);

module.exports = router;
