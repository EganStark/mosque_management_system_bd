const express = require('express');
const { requireAuth, adminOnly } = require('../middleware/auth');
const security = require('../services/security');
const users = require('../services/users');

const router = express.Router();
router.use(requireAuth, adminOnly);
router.get('/', async (req, res, next) => { try { res.render('security/index', { title: 'নিরাপত্তা ও অনুমতি', permissions: security.PERMISSIONS, matrix: await security.matrix() }); } catch (err) { next(err); } });
router.post('/permissions', async (req, res, next) => { try { await security.updateMatrix(req.body); req.flash('success', 'ভূমিকার অনুমতি হালনাগাদ হয়েছে।'); res.redirect('/security'); } catch (err) { next(err); } });
router.get('/audit', async (req, res, next) => { try { const filters = { user_id: req.query.user_id || null, action: req.query.action || null, from: req.query.from || null, to: req.query.to || null }; res.render('security/audit', { title: 'অডিট লগ', rows: await security.logs(filters), userRows: await users.list(), ...filters }); } catch (err) { next(err); } });
module.exports = router;
