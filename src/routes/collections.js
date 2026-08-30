const express = require('express');
const { body, validationResult } = require('express-validator');
const { requireAuth, canWrite } = require('../middleware/auth');
const collections = require('../services/collections');
const members = require('../services/members');
const books = require('../services/books');

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
    });
  } catch (err) { next(err); }
});

router.post(
  '/',
  canWrite,
  body('member_id').notEmpty(),
  body('amount').isFloat({ gt: 0 }),
  body('date').notEmpty(),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        req.flash('error', 'সদস্য, পরিমাণ ও তারিখ সঠিকভাবে দিন।');
        return res.redirect('/collections/new');
      }
      const b = req.body;
      await collections.create({
        member_id: b.member_id,
        purpose: b.purpose || null,
        account: b.account || null,
        book_number_id: b.book_number_id || null,
        receipt_no: b.receipt_no || null,
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

router.post('/:id/delete', canWrite, async (req, res, next) => {
  try {
    await collections.remove(req.params.id);
    req.flash('success', 'মুছে ফেলা হয়েছে।');
    res.redirect('/collections');
  } catch (err) { next(err); }
});

module.exports = router;
