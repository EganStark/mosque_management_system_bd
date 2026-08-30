const express = require('express');
const { requireAuth } = require('../middleware/auth');
const calendar = require('../services/calendar');
const router = express.Router();
router.get('/', requireAuth, async (req, res, next) => { try { const schedule = await calendar.get(req.query.month, req.session.user.role); res.render('calendar/index', { title: 'সমন্বিত ক্যালেন্ডার', schedule }); } catch (error) { next(error); } });
module.exports = router;
