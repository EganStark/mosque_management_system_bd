const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { upload, uploadedPublicUrl, removeUploadedFile } = require('../middleware/upload');
const prayerSettings = require('../services/prayer-settings');
const eventsService = require('../services/events');
const staffService = require('../services/staff');
const announcementsService = require('../services/announcements');
const galleryService = require('../services/gallery');
const faqsService = require('../services/faqs');
const janazaService = require('../services/janaza');
const landingReadiness = require('../services/landing-readiness');
const landingPublishing = require('../services/landing-publishing');
const { requirePermission } = require('../middleware/governance');

const router = express.Router();
router.use(requireAuth);

// Sanitization middleware to remove _csrf from req.body before services write to database
router.use((req, res, next) => {
  if (req.body && req.body._csrf) {
    delete req.body._csrf;
  }
  next();
});

// --- 0. Landing Dashboard Overview ---
router.get('/', async (req, res, next) => {
  try {
    const [readiness, publishing, events, staff, announcements, gallery, faqs, janaza] = await Promise.all([landingReadiness.get(), landingPublishing.overview(), eventsService.list(), staffService.list(), announcementsService.list(), galleryService.list(), faqsService.list(), janazaService.list()]);
    const stats = {
      events: events.length,
      staff: staff.length,
      announcements: announcements.length,
      gallery: gallery.length,
      faqs: faqs.length,
      janaza: janaza.length,
    };
    res.render('landing/dashboard', { title: 'ল্যান্ডিং পেজ ড্যাশবোর্ড', stats, readiness, publishing });
  } catch (err) { next(err); }
});

router.get('/publishing', async (req, res, next) => { try { res.render('landing/publishing', { title: 'কনটেন্ট প্রকাশনা', publishing: await landingPublishing.list(req.query) }); } catch (err) { next(err); } });
router.get('/archive', async (req, res, next) => { try { res.render('landing/archive', { title: 'কনটেন্ট আর্কাইভ', archive: await landingPublishing.archived(req.query) }); } catch (err) { next(err); } });
router.post('/archive/:type/:id/restore', async (req, res) => { try { await landingPublishing.restoreArchived(req.params.type, req.params.id, req.session.user.id); req.flash('success', 'কনটেন্টটি খসড়া হিসেবে পুনরুদ্ধার হয়েছে।'); } catch (err) { req.flash('error', err.message); } res.redirect('/landing/archive'); });
router.post('/archive/restore-bulk', async (req, res) => { try { const result = await landingPublishing.restoreArchivedBulk(req.body.selected, req.session.user.id); req.flash('success', `${result.restored}টি কনটেন্ট খসড়া হিসেবে পুনরুদ্ধার হয়েছে।`); } catch (err) { req.flash('error', err.message); } res.redirect('/landing/archive'); });
router.get('/publishing/export.csv', async (req, res, next) => { try { const data = await landingPublishing.list({ ...req.query, exportAll: true }); res.setHeader('Content-Type', 'text/csv; charset=utf-8'); res.setHeader('Content-Disposition', `attachment; filename="landing-content-${new Date().toISOString().slice(0, 10)}.csv"`); res.send(`\uFEFF${landingPublishing.queueCsv(data)}`); } catch (err) { next(err); } });
router.get('/publishing/history', async (req, res, next) => { try { const filters = landingPublishing.historyFilters(req.query); const params = new URLSearchParams(filters); for (const [key, value] of [...params]) if (!value) params.delete(key); res.render('landing/publishing_history', { title: 'Publishing history', events: await landingPublishing.history(filters), filters, types: Object.entries(landingPublishing.TYPES).map(([value, config]) => ({ value, label: config.label, labelEn: config.labelEn })), exportHref: `/landing/publishing/history.csv${params.toString() ? `?${params}` : ''}` }); } catch (err) { next(err); } });
router.get('/publishing/history.csv', async (req, res, next) => { try { const events = await landingPublishing.history({ ...req.query, limit: 10000 }); res.setHeader('Content-Type', 'text/csv; charset=utf-8'); res.setHeader('Content-Disposition', `attachment; filename="landing-publishing-history-${new Date().toISOString().slice(0, 10)}.csv"`); res.send(`\uFEFF${landingPublishing.historyCsv(events)}`); } catch (err) { next(err); } });
router.get('/publishing/history/:id', async (req, res, next) => { try { const detail = await landingPublishing.historyDetail(req.params.id); if (!detail) return res.status(404).render('error', { title: 'History entry not found', status: 404, message: 'History entry not found.' }); return res.render('landing/publishing_history_detail', { title: 'Publishing change details', detail }); } catch (err) { return next(err); } });
router.post('/publishing/history/:id/restore', requirePermission('website.publish'), async (req, res) => { try { await landingPublishing.restore(req.params.id, req.session.user.id); req.flash('success', 'পুরোনো সংস্করণটি খসড়া হিসেবে পুনরুদ্ধার হয়েছে।'); } catch (err) { req.flash('error', err.message); } res.redirect('/landing/publishing/history'); });
router.get('/publishing/:type/:id/preview', async (req, res, next) => { try { const preview = await landingPublishing.preview(req.params.type, req.params.id); if (!preview) return res.status(404).render('error', { title: 'Content not found', status: 404, message: 'Content not found.' }); return res.render('landing/content_preview', { title: 'Content preview', preview }); } catch (err) { return next(err); } });
router.post('/publishing/:type/:id/review', async (req, res) => { try { await landingPublishing.requestReview(req.params.type, req.params.id, req.session.user.id); req.flash('success', 'কনটেন্টটি প্রকাশকের পর্যালোচনার জন্য পাঠানো হয়েছে।'); } catch (err) { req.flash('error', err.message); } res.redirect('/landing/publishing'); });
router.post('/publishing/:type/:id/changes', requirePermission('website.publish'), async (req, res) => { try { await landingPublishing.requestChanges(req.params.type, req.params.id, req.body.notes, req.session.user.id); req.flash('success', 'পরিবর্তনের অনুরোধ সম্পাদককে পাঠানো হয়েছে।'); } catch (err) { req.flash('error', err.message); } res.redirect(`/landing/publishing/${req.params.type}/${req.params.id}/preview`); });
router.post('/publishing/:type/:id/expiry', requirePermission('website.publish'), async (req, res) => { try { await landingPublishing.setExpiry(req.params.type, req.params.id, req.body.expires_at, req.session.user.id); req.flash('success', 'কনটেন্টের স্বয়ংক্রিয় মেয়াদ শেষ হওয়ার সময় নির্ধারণ হয়েছে।'); } catch (err) { req.flash('error', err.message); } res.redirect(`/landing/publishing/${req.params.type}/${req.params.id}/preview`); });
router.post('/publishing/:type/:id/duplicate', async (req, res) => { try { const copy = await landingPublishing.duplicate(req.params.type, req.params.id, req.session.user.id); req.flash('success', 'কনটেন্টের একটি নতুন খসড়া কপি তৈরি হয়েছে।'); return res.redirect(copy.editHref); } catch (err) { req.flash('error', err.message); return res.redirect('/landing/publishing'); } });
router.post('/publishing/bulk', requirePermission('website.publish'), async (req, res) => { try { const result = await landingPublishing.bulkSetStatus(req.body.selected, req.body.status, req.session.user.id); req.flash('success', `${result.changed}টি কনটেন্ট আপডেট হয়েছে।`); } catch (err) { req.flash('error', err.message); } res.redirect('/landing/publishing'); });
router.post('/publishing/:type/:id', requirePermission('website.publish'), async (req, res) => { try { await landingPublishing.setStatus(req.params.type, req.params.id, req.body.status, req.session.user.id, req.body.scheduled_at); req.flash('success', req.body.status === 'published' ? 'কনটেন্ট প্রকাশ হয়েছে।' : req.body.status === 'scheduled' ? 'কনটেন্ট প্রকাশের সময় নির্ধারণ হয়েছে।' : 'কনটেন্ট খসড়া হিসেবে রাখা হয়েছে।'); } catch (err) { req.flash('error', err.message); } res.redirect('/landing/publishing'); });

// --- 1. Prayer Times ---
router.get('/prayer-times', async (req, res, next) => {
  try {
    const settings = await prayerSettings.get();
    res.render('landing/prayer_times', { title: 'নামাজের সময়সূচী', settings });
  } catch (err) { next(err); }
});

router.post('/prayer-times', async (req, res, next) => {
  try {
    await prayerSettings.upsert(req.body);
    req.flash('success', 'নামাজের সময়সূচী সফলভাবে আপডেট হয়েছে।');
    res.redirect('/landing/prayer-times');
  } catch (err) { next(err); }
});

// --- 2. Events (CRUD) ---
router.get('/events', async (req, res, next) => {
  try {
    const filters = {
      lifecycle: ['upcoming', 'past'].includes(req.query.lifecycle) ? req.query.lifecycle : '',
      recurrence: ['none', 'weekly', 'monthly'].includes(req.query.recurrence) ? req.query.recurrence : '',
      status: ['published', 'draft', 'inactive'].includes(req.query.status) ? req.query.status : '',
    };
    const rows = await eventsService.list(filters);
    res.render('landing/events/list', { title: 'সকল অনুষ্ঠান', rows, filters });
  } catch (err) { next(err); }
});

router.get('/events/new', async (req, res) => {
  res.render('landing/events/form', { title: 'নতুন অনুষ্ঠান', event: null });
});

router.post('/events/new', async (req, res, next) => {
  try {
    await eventsService.create(req.body);
    req.flash('success', 'নতুন অনুষ্ঠান খসড়া হিসেবে সংরক্ষিত হয়েছে। প্রকাশনা তালিকা থেকে যাচাই করে প্রকাশ করুন।');
    res.redirect('/landing/events');
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/landing/events/new');
  }
});

router.get('/events/:id/edit', async (req, res, next) => {
  try {
    const event = await eventsService.find(req.params.id);
    if (!event) return res.redirect('/landing/events');
    res.render('landing/events/form', { title: 'অনুষ্ঠান সম্পাদনা', event });
  } catch (err) { next(err); }
});

router.post('/events/:id/edit', async (req, res, next) => {
  try {
    await eventsService.update(req.params.id, req.body);
    req.flash('success', 'অনুষ্ঠানটি হালনাগাদ করে খসড়ায় রাখা হয়েছে। পুনরায় প্রকাশ করুন।');
    res.redirect('/landing/events');
  } catch (err) {
    req.flash('error', err.message);
    res.redirect(`/landing/events/${req.params.id}/edit`);
  }
});

router.post('/events/:id/delete', async (req, res, next) => {
  try {
    await landingPublishing.archive('events', req.params.id, req.session.user.id);
    req.flash('success', 'অনুষ্ঠান মুছে ফেলা হয়েছে।');
    res.redirect('/landing/events');
  } catch (err) { next(err); }
});

// --- 3. Staff (CRUD) ---
router.get('/staff', async (req, res, next) => {
  try {
    const rows = await staffService.list();
    res.render('landing/staff/list', { title: 'সকল স্টাফ সদস্য', rows });
  } catch (err) { next(err); }
});

router.get('/staff/new', async (req, res) => {
  res.render('landing/staff/form', { title: 'নতুন স্টাফ সদস্য', member: null });
});

router.post('/staff/new', upload.single('photo'), async (req, res, next) => {
  try {
    const data = { ...req.body };
    if (req.file) data.photo = uploadedPublicUrl(req.file);
    await staffService.create(data);
    req.flash('success', 'নতুন স্টাফ সদস্য খসড়া হিসেবে সংরক্ষিত হয়েছে।');
    res.redirect('/landing/staff');
  } catch (err) { next(err); }
});

router.get('/staff/:id/edit', async (req, res, next) => {
  try {
    const member = await staffService.find(req.params.id);
    if (!member) return res.redirect('/landing/staff');
    res.render('landing/staff/form', { title: 'স্টাফ সদস্য সম্পাদনা', member });
  } catch (err) { next(err); }
});

router.post('/staff/:id/edit', upload.single('photo'), async (req, res, next) => {
  try {
    const data = { ...req.body };
    if (req.file) data.photo = uploadedPublicUrl(req.file);
    await staffService.update(req.params.id, data);
    req.flash('success', 'স্টাফ তথ্য হালনাগাদ করে খসড়ায় রাখা হয়েছে। পুনরায় প্রকাশ করুন।');
    res.redirect('/landing/staff');
  } catch (err) { next(err); }
});

router.post('/staff/:id/delete', async (req, res, next) => {
  try {
    await landingPublishing.archive('staff', req.params.id, req.session.user.id);
    req.flash('success', 'স্টাফ সদস্য মুছে ফেলা হয়েছে।');
    res.redirect('/landing/staff');
  } catch (err) { next(err); }
});

// --- 4. Announcements (CRUD) ---
router.get('/announcements', async (req, res, next) => {
  try {
    const rows = await announcementsService.list();
    res.render('landing/announcements/list', { title: 'সকল ঘোষণা', rows });
  } catch (err) { next(err); }
});

router.get('/announcements/new', async (req, res) => {
  res.render('landing/announcements/form', { title: 'নতুন ঘোষণা', announcement: null });
});

router.post('/announcements/new', async (req, res, next) => {
  try {
    await announcementsService.create(req.body);
    req.flash('success', 'নতুন ঘোষণা খসড়া হিসেবে সংরক্ষিত হয়েছে।');
    res.redirect('/landing/announcements');
  } catch (err) { next(err); }
});

router.get('/announcements/:id/edit', async (req, res, next) => {
  try {
    const announcement = await announcementsService.find(req.params.id);
    if (!announcement) return res.redirect('/landing/announcements');
    res.render('landing/announcements/form', { title: 'ঘোষণা সম্পাদনা', announcement });
  } catch (err) { next(err); }
});

router.post('/announcements/:id/edit', async (req, res, next) => {
  try {
    await announcementsService.update(req.params.id, req.body);
    req.flash('success', 'ঘোষণাটি হালনাগাদ করে খসড়ায় রাখা হয়েছে। পুনরায় প্রকাশ করুন।');
    res.redirect('/landing/announcements');
  } catch (err) { next(err); }
});

router.post('/announcements/:id/delete', async (req, res, next) => {
  try {
    await landingPublishing.archive('announcements', req.params.id, req.session.user.id);
    req.flash('success', 'ঘোষণা মুছে ফেলা হয়েছে।');
    res.redirect('/landing/announcements');
  } catch (err) { next(err); }
});

// --- 5. Gallery Images (CRUD) ---
router.get('/gallery', async (req, res, next) => {
  try {
    const rows = await galleryService.list();
    res.render('landing/gallery/list', { title: 'গ্যালারি ছবিসমূহ', rows });
  } catch (err) { next(err); }
});

router.get('/gallery/new', async (req, res) => {
  res.render('landing/gallery/form', { title: 'নতুন গ্যালারি ছবি', image: null });
});

router.post('/gallery/new', upload.single('image'), async (req, res, next) => {
  try {
    const data = { ...req.body };
    if (req.file) {
      data.image_path = uploadedPublicUrl(req.file);
    } else if (!data.image_path) {
      req.flash('error', 'একটি ছবি আপলোড করুন অথবা ছবির ইউআরএল দিন।');
      return res.redirect('/landing/gallery/new');
    }
    const image = await galleryService.create(data);
    await landingPublishing.setStatus('gallery', image.id, 'published', req.session.user.id);
    req.flash('success', 'নতুন গ্যালারি ছবি সংরক্ষণ ও প্রকাশ হয়েছে।');
    res.redirect('/landing/gallery');
  } catch (err) {
    if (req.file) await removeUploadedFile(uploadedPublicUrl(req.file)).catch(() => false);
    next(err);
  }
});

router.get('/gallery/:id/edit', async (req, res, next) => {
  try {
    const image = await galleryService.find(req.params.id);
    if (!image) return res.redirect('/landing/gallery');
    res.render('landing/gallery/form', { title: 'গ্যালারি ছবি সম্পাদনা', image });
  } catch (err) { next(err); }
});

router.post('/gallery/:id/edit', upload.single('image'), async (req, res, next) => {
  let previousImage;
  try {
    previousImage = await galleryService.find(req.params.id);
    if (!previousImage) {
      if (req.file) await removeUploadedFile(uploadedPublicUrl(req.file)).catch(() => false);
      return res.redirect('/landing/gallery');
    }
    const data = { ...req.body };
    if (req.file) data.image_path = uploadedPublicUrl(req.file);
    await galleryService.update(req.params.id, data);
    await landingPublishing.setStatus('gallery', req.params.id, 'published', req.session.user.id);
    if (req.file && previousImage.image_path !== data.image_path) {
      await removeUploadedFile(previousImage.image_path).catch(() => false);
    }
    req.flash('success', 'গ্যালারি ছবিটি হালনাগাদ ও প্রকাশ হয়েছে।');
    res.redirect('/landing/gallery');
  } catch (err) {
    if (req.file) await removeUploadedFile(uploadedPublicUrl(req.file)).catch(() => false);
    next(err);
  }
});

router.post('/gallery/:id/move', async (req, res) => {
  try {
    const moved = await galleryService.move(req.params.id, req.body.direction);
    req.flash('success', moved ? 'গ্যালারির ছবির ক্রম হালনাগাদ হয়েছে।' : 'ছবিটি ইতোমধ্যে এই প্রান্তে আছে।');
  } catch (err) {
    req.flash('error', err.message);
  }
  res.redirect('/landing/gallery');
});

router.post('/gallery/:id/delete', async (req, res, next) => {
  try {
    await landingPublishing.archive('gallery', req.params.id, req.session.user.id);
    req.flash('success', 'ছবিটি গ্যালারি থেকে মুছে ফেলা হয়েছে।');
    res.redirect('/landing/gallery');
  } catch (err) { next(err); }
});

// --- 6. FAQs (CRUD) ---
router.get('/faq', async (req, res, next) => {
  try {
    const rows = await faqsService.list();
    res.render('landing/faq/list', { title: 'সকল FAQ', rows });
  } catch (err) { next(err); }
});

router.get('/faq/new', async (req, res) => {
  res.render('landing/faq/form', { title: 'নতুন FAQ', faq: null });
});

router.post('/faq/new', async (req, res, next) => {
  try {
    await faqsService.create(req.body);
    req.flash('success', 'নতুন FAQ খসড়া হিসেবে সংরক্ষিত হয়েছে।');
    res.redirect('/landing/faq');
  } catch (err) { next(err); }
});

router.get('/faq/:id/edit', async (req, res, next) => {
  try {
    const faq = await faqsService.find(req.params.id);
    if (!faq) return res.redirect('/landing/faq');
    res.render('landing/faq/form', { title: 'FAQ সম্পাদনা', faq });
  } catch (err) { next(err); }
});

router.post('/faq/:id/edit', async (req, res, next) => {
  try {
    await faqsService.update(req.params.id, req.body);
    req.flash('success', 'FAQ হালনাগাদ করে খসড়ায় রাখা হয়েছে। পুনরায় প্রকাশ করুন।');
    res.redirect('/landing/faq');
  } catch (err) { next(err); }
});

router.post('/faq/:id/delete', async (req, res, next) => {
  try {
    await landingPublishing.archive('faq', req.params.id, req.session.user.id);
    req.flash('success', 'FAQ মুছে ফেলা হয়েছে।');
    res.redirect('/landing/faq');
  } catch (err) { next(err); }
});

// --- 7. Janaza Notices (CRUD) ---
router.get('/janaza', async (req, res, next) => {
  try {
    const rows = await janazaService.list();
    res.render('landing/janaza/list', { title: 'সকল জানাযা নোটিশ', rows });
  } catch (err) { next(err); }
});

router.get('/janaza/new', async (req, res) => {
  res.render('landing/janaza/form', { title: 'নতুন জানাযা নোটিশ', notice: null });
});

router.post('/janaza/new', async (req, res, next) => {
  try {
    await janazaService.create(req.body);
    req.flash('success', 'নতুন জানাযা নোটিশ খসড়া হিসেবে সংরক্ষিত হয়েছে।');
    res.redirect('/landing/janaza');
  } catch (err) { next(err); }
});

router.get('/janaza/:id/edit', async (req, res, next) => {
  try {
    const notice = await janazaService.find(req.params.id);
    if (!notice) return res.redirect('/landing/janaza');
    res.render('landing/janaza/form', { title: 'জানাযা নোটিশ সম্পাদনা', notice });
  } catch (err) { next(err); }
});

router.post('/janaza/:id/edit', async (req, res, next) => {
  try {
    await janazaService.update(req.params.id, req.body);
    req.flash('success', 'জানাযা নোটিশ হালনাগাদ করে খসড়ায় রাখা হয়েছে। পুনরায় প্রকাশ করুন।');
    res.redirect('/landing/janaza');
  } catch (err) { next(err); }
});

router.post('/janaza/:id/delete', async (req, res, next) => {
  try {
    await landingPublishing.archive('janaza', req.params.id, req.session.user.id);
    req.flash('success', 'জানাযা নোটিশ মুছে ফেলা হয়েছে।');
    res.redirect('/landing/janaza');
  } catch (err) { next(err); }
});

module.exports = router;
