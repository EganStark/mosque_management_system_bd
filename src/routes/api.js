const express = require('express');
const rateLimit = require('express-rate-limit');
const db = require('../config/db');
const publicInbox = require('../services/public-inbox');
const prayerSettings = require('../services/prayer-settings');
const eventsService = require('../services/events');
const staffService = require('../services/staff');
const announcementsService = require('../services/announcements');
const galleryService = require('../services/gallery');
const faqsService = require('../services/faqs');
const janazaService = require('../services/janaza');
const landingPublishing = require('../services/landing-publishing');

const router = express.Router();
const submissionLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 8, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many submissions. Please try again later.' } });
let publishingCheck = null;
let lastPublishingCheckAt = 0;

router.use((req, res, next) => {
  const allowedOrigins = (process.env.LANDING_PAGE_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const requestOrigin = req.get('Origin');
  if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    res.header('Access-Control-Allow-Origin', requestOrigin);
    res.header('Vary', 'Origin');
  }
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  return next();
});

// Free hosts can suspend background timers. Reconcile due/expired landing content
// on the first public read after a wake-up, throttled to avoid extra database work.
router.use(async (req, res, next) => {
  if (req.method !== 'GET' || Date.now() - lastPublishingCheckAt < 60_000) return next();
  try {
    if (!publishingCheck) {
      publishingCheck = landingPublishing.publishDue()
        .then(() => { lastPublishingCheckAt = Date.now(); })
        .finally(() => { publishingCheck = null; });
    }
    await publishingCheck;
    return next();
  } catch (error) {
    return next(error);
  }
});

router.get('/prayer-times', async (req, res, next) => {
  try {
    const settings = await prayerSettings.get();
    res.json({
      date: new Date().toLocaleDateString('bn-BD'),
      hijriDate: settings.hijri_date,
      prayers: [
        { name: 'Fajr', start: settings.fajr_start, jamaat: settings.fajr, end: settings.fajr_end, status: 'Upcoming' },
        { name: 'Dhuhr', start: settings.dhuhr_start, jamaat: settings.dhuhr, end: settings.dhuhr_end, status: 'Upcoming' },
        { name: 'Asr', start: settings.asr_start, jamaat: settings.asr, end: settings.asr_end, status: 'Upcoming' },
        { name: 'Maghrib', start: settings.maghrib_start, jamaat: settings.maghrib, end: settings.maghrib_end, status: 'Upcoming' },
        { name: 'Isha', start: settings.isha_start, jamaat: settings.isha, end: settings.isha_end, status: 'Upcoming' },
      ],
      fasting: { sahriEnd: settings.sahri_end, iftar: settings.iftar_time },
      forbidden: [
        { key: 'sunrise', start: settings.sunrise, end: settings.sunrise_forbidden_end },
        { key: 'zawal', start: settings.zawal_start, end: settings.zawal_end },
        { key: 'sunset', start: settings.sunset_forbidden_start, end: settings.maghrib },
      ],
      venue: {
        name: settings.venue_name,
        address: settings.venue_address,
        phone: settings.venue_phone,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/events', async (req, res, next) => {
  try {
    const rows = await eventsService.listActive();
    const normalizeDate = (date) => {
      if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
      const parts = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Dhaka', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(date));
      const value = (type) => parts.find((part) => part.type === type)?.value;
      return `${value('year')}-${value('month')}-${value('day')}`;
    };
    const formatDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const horizon = new Date(); horizon.setFullYear(horizon.getFullYear() + 1);
    const events = [];
    for (const row of rows) {
      const firstDate = normalizeDate(row.event_date);
      const [year, month, day] = firstDate.split('-').map(Number);
      const recurrence = ['weekly', 'monthly'].includes(row.recurrence_type) ? row.recurrence_type : 'none';
      const configuredEnd = row.recurrence_until ? new Date(`${normalizeDate(row.recurrence_until)}T00:00:00`) : horizon;
      const end = configuredEnd < horizon ? configuredEnd : horizon;
      let occurrence = new Date(year, month - 1, day);
      let index = 0;
      while (index < 366 && (recurrence === 'none' ? index === 0 : occurrence <= end)) {
        events.push({ ...row, event_date: formatDate(occurrence), occurrence_index: index, occurrence_key: `${row.id}:${formatDate(occurrence)}` });
        if (recurrence === 'none') break;
        if (recurrence === 'weekly') occurrence = new Date(occurrence.getFullYear(), occurrence.getMonth(), occurrence.getDate() + 7);
        else { const targetMonth = occurrence.getMonth() + 1; const lastDay = new Date(occurrence.getFullYear(), targetMonth + 1, 0).getDate(); occurrence = new Date(occurrence.getFullYear(), targetMonth, Math.min(day, lastDay)); }
        index += 1;
      }
    }
    events.sort((a, b) => a.event_date.localeCompare(b.event_date) || String(a.event_time).localeCompare(String(b.event_time)));
    res.json({ events, total: events.length });
  } catch (error) {
    next(error);
  }
});

router.get('/dashboard-stats', async (req, res) => {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);

    const monthlyCollections = await sumAmount('collections', { from: monthStart, to: monthEnd });
    const monthlyExpenses = await sumAmount('expenses', { from: monthStart, to: monthEnd });
    const totalCollections = await sumAmount('collections');
    const totalExpenses = await sumAmount('expenses');
    const prevCollections = await sumAmount('collections', { from: prevMonthStart, to: prevMonthEnd });
    const balance = totalCollections - totalExpenses;

    const collectionsTrend = prevCollections > 0
      ? Number((((monthlyCollections - prevCollections) / prevCollections) * 100).toFixed(1))
      : 0;

    res.json({
      thisMonth: {
        collections: monthlyCollections,
        collectionsFormatted: monthlyCollections.toLocaleString('bn-BD'),
        expenses: monthlyExpenses,
        expensesFormatted: monthlyExpenses.toLocaleString('bn-BD'),
        balance,
        balanceFormatted: balance.toLocaleString('bn-BD'),
      },
      trends: {
        collectionsTrend,
        expensesTrend: 0,
        balanceTrend: 0,
      },
      allTime: {
        totalCollections: totalCollections.toLocaleString('bn-BD'),
        totalExpenses: totalExpenses.toLocaleString('bn-BD'),
      },
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

router.get('/donations/recent', async (req, res) => {
  try {
    const limit = Math.min(Number.parseInt(req.query.limit, 10) || 6, 50);
    const rows = await db('collections as c')
      .leftJoin('members as m', 'c.member_id', 'm.id')
      .select('c.id', 'c.amount', 'c.date', 'c.purpose', 'c.remarks', 'c.payer_name', 'm.name as donor_name')
      .where('c.status', 'posted')
      .orderBy('c.date', 'desc')
      .orderBy('c.id', 'desc')
      .limit(limit);

    const donations = rows.map((row) => ({
      id: row.id,
      amount: Number(row.amount || 0),
      amountFormatted: Number(row.amount || 0).toLocaleString('bn-BD'),
      donorName: row.donor_name || row.payer_name || 'Anonymous',
      donationType: row.purpose || 'General Donation',
      date: row.date,
      dateFormatted: formatRelativeDate(new Date(row.date)),
      verified: true,
      avatar: generateAvatar(row.donor_name || row.payer_name),
    }));

    res.json({ donations, total: donations.length });
  } catch (error) {
    console.error('Recent donations error:', error);
    res.status(500).json({ error: 'Failed to fetch donations' });
  }
});

router.get('/members/count', async (req, res) => {
  try {
    const [total, male, female, familyHeads] = await Promise.all([
      countMembers({ status: 'active' }),
      countMembers({ status: 'active', gender: 'male' }),
      countMembers({ status: 'active', gender: 'female' }),
      countMembers({ status: 'active', monthly_payment: true }),
    ]);

    res.json({
      total,
      male,
      female,
      familyHeads,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Members count error:', error);
    res.status(500).json({ error: 'Failed to fetch member statistics' });
  }
});

router.get('/announcements', async (req, res, next) => {
  try {
    const rows = await announcementsService.listActive();
    res.json({ announcements: rows, total: rows.length });
  } catch (error) {
    next(error);
  }
});

router.get('/company-settings', async (req, res) => {
  try {
    const row = await db('company_settings').orderBy('id').first();
    res.json({
      name: row?.company_name || 'Baitur Rahman Jame Mosjid',
      tagline: 'A Sanctuary of Peace & Faith',
      address: row?.company_address || 'Dhaka, Bangladesh',
      phone: row?.company_phone || '+880 1234-567890',
      email: row?.company_email || 'info@mosque.com',
      logoUrl: row?.logo || '/static/images/logo.png',
      officeHours: {
        weekday: '9:00 AM - 5:00 PM',
        saturday: '10:00 AM - 2:00 PM',
        sunday: 'Closed',
      },
      established: 2010,
      mission: 'Serving our community with faith, unity, and transparency',
      social: {
        facebook: 'https://facebook.com/mosque',
        youtube: 'https://youtube.com/@mosque',
        instagram: 'https://instagram.com/mosque',
      },
    });
  } catch (error) {
    console.error('Company settings error:', error);
    res.status(500).json({ error: 'Failed to fetch company settings' });
  }
});

router.get('/gallery', async (req, res, next) => {
  try {
    const rows = await galleryService.listActive();
    res.json({ images: rows, total: rows.length });
  } catch (error) {
    next(error);
  }
});

router.get('/staff', async (req, res, next) => {
  try {
    const rows = await staffService.listActive();
    res.json({ staff: rows, total: rows.length });
  } catch (error) {
    next(error);
  }
});

router.get('/faq', async (req, res, next) => {
  try {
    const rows = await faqsService.listActive();
    res.json({ faqs: rows, total: rows.length });
  } catch (error) {
    next(error);
  }
});

router.get('/janaza', async (req, res, next) => {
  try {
    const rows = await janazaService.listActive();
    res.json({ notices: rows, total: rows.length });
  } catch (error) {
    next(error);
  }
});

router.post('/contact', submissionLimiter, async (req, res, next) => {
  const fullName = String(req.body.fullName || req.body.name || '').trim();
  const email = String(req.body.email || '').trim();
  const subject = String(req.body.subject || '').trim();
  const message = String(req.body.message || '').trim();
  if (!fullName || !/^\S+@\S+\.\S+$/.test(email) || !subject || message.length < 10 || message.length > 5000) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try { const item = await publicInbox.createContact({ ...req.body, fullName, email, subject, message }, req.ip); return res.status(201).json({ success: true, message: 'Thank you for contacting us. We will respond soon.', ticketNumber: item.ticket_no, timestamp: item.created_at }); } catch (error) { return next(error); }
});

router.post('/donations/submit', submissionLimiter, async (req, res, next) => {
  const donationType = req.body.donationType || req.body.type, paymentMethod = req.body.paymentMethod || req.body.method, transactionId = req.body.transactionId || req.body.tid;
  const donorName = String(req.body.donorName || req.body.name || '').trim(), phone = String(req.body.phone || '').trim();
  if (!['general','zakat','monthly','special'].includes(donationType) || !['bkash','nagad','rocket','bank'].includes(paymentMethod) || !transactionId || !donorName || !phone) {
    return res.status(400).json({ error: 'Missing required donation fields' });
  }
  try { const item = await publicInbox.createDonation({ ...req.body, donationType, paymentMethod, transactionId, donorName, phone }, req.ip); return res.status(201).json({ success: true, message: 'Donation submitted for verification. Thank you!', confirmationNumber: item.confirmation_no, timestamp: item.created_at }); } catch (error) { if(error.message.includes('already been submitted'))return res.status(409).json({error:error.message});return next(error); }
});

router.post('/sms/status', async (req, res) => {
  const secret = process.env.SMS_WEBHOOK_SECRET || '';
  const supplied = String(req.get('x-webhook-secret') || '');
  if (!secret || supplied.length !== secret.length || !require('crypto').timingSafeEqual(Buffer.from(supplied), Buffer.from(secret))) return res.status(401).json({ error: 'Unauthorized' });
  const messageId = String(req.body.message_id || req.body.id || '').trim();
  const status = String(req.body.status || '').toLowerCase();
  if (!messageId || !['delivered','failed','rejected'].includes(status)) return res.status(400).json({ error: 'Invalid delivery update' });
  const item = await db('communications').where({ provider_message_id: messageId }).first();
  if (!item) return res.status(404).json({ error: 'Message not found' });
  const delivered = status === 'delivered';
  await db('communications').where({ id: item.id }).update({ delivery_status: status, delivered_at: delivered ? db.fn.now() : null, status: delivered ? 'sent' : 'failed', last_error: delivered ? null : String(req.body.error || `Provider marked ${status}`).slice(0,1000), updated_at: db.fn.now() });
  return res.json({ success: true });
});

async function sumAmount(table, { from, to } = {}) {
  const query = db(table).sum('amount as total');
  if (from) query.where('date', '>=', from);
  if (to) query.where('date', '<=', to);
  const [row] = await query;
  return Number(row.total || 0);
}

async function countMembers(where) {
  const [row] = await db('members').where(where).count('* as total');
  return Number(row.total || 0);
}

function formatRelativeDate(date) {
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('bn-BD');
}

function generateAvatar(name) {
  if (!name) return 'A';
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();
}

module.exports = router;
