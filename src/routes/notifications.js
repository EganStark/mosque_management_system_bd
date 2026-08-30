const express = require('express');
const { requireAuth } = require('../middleware/auth');
const notifications = require('../services/notifications');
const router = express.Router(); router.use(requireAuth);
router.get('/', async (req, res, next) => { try { res.render('notifications/index', { title: 'নোটিফিকেশন', notifications: await notifications.list(req.session.user) }); } catch (e) { next(e); } });
router.post('/read', async (req, res) => { const item = await notifications.markRead(req.session.user, req.body.key); res.redirect(item && item.href.startsWith('/') ? item.href : '/notifications'); });
router.post('/read-all', async (req, res, next) => { try { await notifications.markAll(req.session.user); req.flash('success', 'সব নোটিফিকেশন পড়া হিসেবে চিহ্নিত হয়েছে।'); res.redirect('/notifications'); } catch (e) { next(e); } });
module.exports = router;
