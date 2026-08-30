const express = require('express');
const { requireAuth } = require('../middleware/auth');
const reports = require('../services/reports');
const members = require('../services/members');

const router = express.Router();

router.get('/', requireAuth, (req, res) => res.redirect('/dashboard'));

router.get('/dashboard', requireAuth, async (req, res, next) => {
  try {
    const stats = await reports.dashboard();
    const memberCounts = await members.counts();
    res.render('dashboard/index', { title: 'ড্যাশবোর্ড', stats, memberCounts });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
