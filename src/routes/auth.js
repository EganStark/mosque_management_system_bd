const express = require('express');
const { body, validationResult } = require('express-validator');
const usersService = require('../services/users');
const { loginLimiter } = require('../middleware/security');

const router = express.Router();

router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');
  res.render('auth/login', { title: 'লগইন', layout: 'layout_blank' });
});

router.post(
  '/login',
  loginLimiter,
  body('username').trim().notEmpty(),
  body('password').notEmpty(),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        req.flash('error', 'ইউজারনেম ও পাসওয়ার্ড দিন।');
        return res.redirect('/login');
      }
      const { username, password } = req.body;
      const user = await usersService.findByUsername(username);
      const ok = user && user.is_active && (await usersService.verifyPassword(user, password));
      if (!ok) {
        req.flash('error', 'ভুল ইউজারনেম বা পাসওয়ার্ড।');
        return res.redirect('/login');
      }
      const dest = req.session.returnTo || '/dashboard';
      req.session.regenerate((sessionErr) => {
        if (sessionErr) return next(sessionErr);
        req.session.user = { id: user.id, name: user.name, username: user.username, role: user.role };
        req.flash('success', 'স্বাগতম, ' + user.name + '!');
        return res.redirect(dest);
      });
    } catch (err) {
      next(err);
    }
  }
);

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('brjm.sid');
    res.redirect('/login');
  });
});

module.exports = router;
