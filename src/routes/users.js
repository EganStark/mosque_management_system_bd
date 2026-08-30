const express = require('express');
const { body, validationResult } = require('express-validator');
const { requireAuth, adminOnly } = require('../middleware/auth');
const usersService = require('../services/users');

const router = express.Router();
router.use(requireAuth, adminOnly);

router.get('/', async (req, res, next) => {
  try {
    const users = await usersService.list();
    res.render('users/list', { title: 'ব্যবহারকারী', users });
  } catch (err) {
    next(err);
  }
});

router.get('/new', (req, res) => {
  res.render('users/form', { title: 'নতুন ব্যবহারকারী', user: null, roles: usersService.ROLES });
});

router.get('/:id/edit', async (req, res, next) => {
  try {
    const user = await usersService.findById(req.params.id);
    if (!user) return res.redirect('/users');
    res.render('users/form', { title: 'ব্যবহারকারী সম্পাদনা', user, roles: usersService.ROLES });
  } catch (err) {
    next(err);
  }
});

router.post(
  '/',
  body('name').trim().notEmpty(),
  body('username').trim().notEmpty(),
  body('password').isLength({ min: 6 }),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        req.flash('error', 'সব ঘর সঠিকভাবে পূরণ করুন (পাসওয়ার্ড অন্তত ৬ অক্ষর)।');
        return res.redirect('/users/new');
      }
      const { name, username, email, password, role } = req.body;
      await usersService.create({
        name, username, email, password,
        role: usersService.ROLES.includes(role) ? role : 'viewer',
        is_active: req.body.is_active === 'on' || req.body.is_active === 'true',
      });
      req.flash('success', 'ব্যবহারকারী যুক্ত হয়েছে।');
      res.redirect('/users');
    } catch (err) {
      if (err.code === '23505') {
        req.flash('error', 'এই ইউজারনেম আগে থেকেই আছে।');
        return res.redirect('/users/new');
      }
      next(err);
    }
  }
);

router.post('/:id', async (req, res, next) => {
  try {
    const { name, username, email, role, password } = req.body;
    await usersService.update(req.params.id, {
      name, username, email,
      role: usersService.ROLES.includes(role) ? role : 'viewer',
      is_active: req.body.is_active === 'on' || req.body.is_active === 'true',
      password: password && password.trim() ? password : undefined,
    });
    req.flash('success', 'তথ্য হালনাগাদ হয়েছে।');
    res.redirect('/users');
  } catch (err) {
    next(err);
  }
});

router.post('/:id/delete', async (req, res, next) => {
  try {
    if (Number(req.params.id) === req.session.user.id) {
      req.flash('error', 'আপনি নিজের অ্যাকাউন্ট মুছতে পারবেন না।');
      return res.redirect('/users');
    }
    await usersService.remove(req.params.id);
    req.flash('success', 'ব্যবহারকারী মুছে ফেলা হয়েছে।');
    res.redirect('/users');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
