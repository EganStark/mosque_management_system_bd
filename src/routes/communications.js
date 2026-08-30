const express = require('express');
const { body, validationResult } = require('express-validator');
const { requireAuth, canWrite, adminOnly } = require('../middleware/auth');
const communications = require('../services/communications');

const router = express.Router();
router.use(requireAuth);
function currentMonth() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }

router.get('/', async (req, res, next) => {
  try {
    const month = /^\d{4}-\d{2}$/.test(req.query.month || '') ? req.query.month : currentMonth();
    const [templates, recipients, history] = await Promise.all([communications.templates(), communications.recipients(month), communications.history()]);
    res.render('communications/index', { title: 'যোগাযোগ কেন্দ্র', month, templates, recipients, history, providerStatus: communications.providerStatus() });
  } catch (err) { next(err); }
});

router.get('/operations', adminOnly, async (req,res,next)=>{try{const month=/^\d{4}-\d{2}$/.test(req.query.month||'')?req.query.month:currentMonth();const type=['monthly','pledge','loan'].includes(req.query.type)?req.query.type:'monthly';const[queue,summary,candidates]=await Promise.all([communications.queue(),communications.deliverySummary(),communications.reminderCandidates(type,month)]);res.render('communications/operations',{title:'SMS ডেলিভারি অপারেশন',month,type,queue,summary,candidates,providerStatus:communications.providerStatus()});}catch(e){next(e);}});
router.post('/operations/reminders',adminOnly,body('type').isIn(['monthly','pledge','loan']),async(req,res)=>{try{if(!validationResult(req).isEmpty())throw new Error('সঠিক স্মরণিকার ধরন দিন');const result=await communications.prepareReminders(req.body.type,req.body.month,req.session.user.id);req.flash('success',`${result.created}টি নতুন স্মরণিকার খসড়া তৈরি হয়েছে (${result.candidates}টি যোগ্য রেকর্ড)।`);}catch(e){req.flash('error',e.message);}res.redirect(`/communications/operations?type=${encodeURIComponent(req.body.type||'monthly')}&month=${encodeURIComponent(req.body.month||currentMonth())}`);});
router.post('/operations/process',adminOnly,async(req,res)=>{try{const result=await communications.processDue(25);req.flash('success',`${result.sent}টি পাঠানো হয়েছে; ${result.failed}টি ব্যর্থ।`);}catch(e){req.flash('error',e.message);}res.redirect('/communications/operations');});

router.post('/drafts/bulk', canWrite, body('template_id').isInt(), async (req, res, next) => {
  try {
    if (!validationResult(req).isEmpty()) { req.flash('error', 'টেমপ্লেট নির্বাচন করুন।'); return res.redirect('/communications'); }
    const drafts = await communications.createBulkDrafts(req.body, req.session.user.id);
    req.flash('success', `${drafts.length}টি খসড়া তৈরি হয়েছে; কোনো SMS এখনো পাঠানো হয়নি।`);
    res.redirect('/communications');
  } catch (err) { req.flash('error', err.message); res.redirect('/communications'); }
});

router.post('/drafts', canWrite, body('member_id').isInt(), body('template_id').isInt(), async (req, res, next) => {
  try {
    if (!validationResult(req).isEmpty()) { req.flash('error', 'সদস্য ও টেমপ্লেট নির্বাচন করুন।'); return res.redirect('/communications'); }
    const draft = await communications.createDraft(req.body, req.session.user.id);
    req.flash('success', 'খসড়া তৈরি হয়েছে। যাচাই না করে কোনো SMS পাঠানো হয়নি।');
    res.redirect(`/communications/${draft.id}`);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try { const item = await communications.find(req.params.id); if (!item) return res.redirect('/communications'); res.render('communications/view', { title: item.channel === 'letter' ? 'চিঠি প্রিভিউ' : 'SMS প্রিভিউ', item, providerStatus: communications.providerStatus() }); } catch (err) { next(err); }
});

router.post('/:id/approve', adminOnly, async (req, res) => {
  try { await communications.approve(req.params.id, req.session.user.id); req.flash('success', 'খসড়াটি অনুমোদিত হয়েছে।'); } catch (err) { req.flash('error', err.message); }
  res.redirect(`/communications/${req.params.id}`);
});
router.post('/:id/schedule',adminOnly,body('scheduled_for').isISO8601(),async(req,res)=>{try{if(!validationResult(req).isEmpty())throw new Error('সঠিক তারিখ ও সময় দিন');await communications.schedule(req.params.id,req.body.scheduled_for,req.session.user.id);req.flash('success','SMS নির্ধারিত সময়ে পাঠানোর সারিতে রাখা হয়েছে।');}catch(e){req.flash('error',e.message);}res.redirect(`/communications/${req.params.id}`);});

router.post('/:id/send', adminOnly, async (req, res) => {
  try { await communications.sendApproved(req.params.id); req.flash('success', 'SMS gateway বার্তাটি গ্রহণ করেছে।'); } catch (err) { req.flash('error', err.message); }
  res.redirect(`/communications/${req.params.id}`);
});

router.post('/templates/:id', adminOnly, body('name').trim().notEmpty(), body('body').trim().notEmpty(), async (req, res, next) => {
  try { if (!validationResult(req).isEmpty()) { req.flash('error', 'টেমপ্লেটের নাম ও লেখা আবশ্যক।'); return res.redirect('/communications'); } await communications.updateTemplate(req.params.id, req.body); req.flash('success', 'টেমপ্লেট হালনাগাদ হয়েছে।'); res.redirect('/communications'); } catch (err) { next(err); }
});

module.exports = router;
