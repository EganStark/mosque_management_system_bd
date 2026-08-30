const express = require('express');
const { requireAuth, adminOnly } = require('../middleware/auth');
const books = require('../services/books');
const usersService = require('../services/users');

const router = express.Router();
router.use(requireAuth, adminOnly);

// --- Book Types ---
router.get('/types', async (req, res, next) => {
  try {
    res.render('books/types', { title: 'বই এর ধরন', rows: await books.types.all() });
  } catch (err) { next(err); }
});

router.post('/types', async (req, res, next) => {
  try {
    await books.types.create({ name: req.body.name, monthly_book: req.body.monthly_book === 'on' });
    req.flash('success', 'বই যুক্ত হয়েছে।');
    res.redirect('/books/types');
  } catch (err) { next(err); }
});

router.post('/types/:id', async (req, res, next) => {
  try {
    await books.types.update(req.params.id, { name: req.body.name, monthly_book: req.body.monthly_book === 'on' });
    req.flash('success', 'হালনাগাদ হয়েছে।');
    res.redirect('/books/types');
  } catch (err) { next(err); }
});

router.post('/types/:id/delete', async (req, res, next) => {
  try {
    await books.types.remove(req.params.id);
    req.flash('success', 'মুছে ফেলা হয়েছে।');
    res.redirect('/books/types');
  } catch (err) {
    req.flash('error', 'মুছে ফেলা যায়নি।');
    res.redirect('/books/types');
  }
});

// --- Book Numbers ---
router.get('/numbers', async (req, res, next) => {
  try {
    res.render('books/numbers', {
      title: 'বই নম্বর',
      rows: await books.numbers.list(),
      bookTypes: await books.types.all(),
      collectors: await usersService.list(),
    });
  } catch (err) { next(err); }
});

router.post('/numbers', async (req, res, next) => {
  try {
    const b = req.body;
    await books.numbers.create({
      book_type_id: b.book_type_id || null,
      book_number: b.book_number,
      receipt_from: b.receipt_from || null,
      receipt_to: b.receipt_to || null,
      collector_id: b.collector_id || null,
      issue_date: b.issue_date || null,
      status: b.status === 'deactive' ? 'deactive' : 'active',
    });
    req.flash('success', 'বই নম্বর যুক্ত হয়েছে।');
    res.redirect('/books/numbers');
  } catch (err) { next(err); }
});

router.post('/numbers/:id', async (req, res, next) => {
  try {
    const b = req.body;
    await books.numbers.update(req.params.id, {
      book_type_id: b.book_type_id || null,
      book_number: b.book_number,
      receipt_from: b.receipt_from || null,
      receipt_to: b.receipt_to || null,
      collector_id: b.collector_id || null,
      issue_date: b.issue_date || null,
      status: b.status === 'deactive' ? 'deactive' : 'active',
    });
    req.flash('success', 'হালনাগাদ হয়েছে।');
    res.redirect('/books/numbers');
  } catch (err) { next(err); }
});

router.post('/numbers/:id/delete', async (req, res, next) => {
  try {
    await books.numbers.remove(req.params.id);
    req.flash('success', 'মুছে ফেলা হয়েছে।');
    res.redirect('/books/numbers');
  } catch (err) {
    req.flash('error', 'মুছে ফেলা যায়নি।');
    res.redirect('/books/numbers');
  }
});

module.exports = router;
