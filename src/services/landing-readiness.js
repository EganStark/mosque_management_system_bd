const db = require('../config/db');
function filled(value) { return value !== null && value !== undefined && String(value).trim() !== ''; }
function evaluate(name, href, rows, fields, label, minimum = 1) { const active = rows.filter((row) => row.is_active !== false && (!row.publication_status || row.publication_status === 'published')); const inactive = rows.length - active.length; const issues = []; let present = 0; const expected = Math.max(minimum, active.length) * fields.length; for (const row of active) { const missing = fields.filter((field) => !filled(row[field])); present += fields.length - missing.length; if (missing.length) issues.push({ label: row[label] || `#${row.id}`, missing }); } const score = minimum === 0 && !active.length ? 100 : active.length < minimum ? 0 : Math.round(present / expected * 100); return { name, href, total: rows.length, active: active.length, inactive, incomplete: issues.length, score, issues: issues.slice(0, 8) }; }
async function get() {
  const [settings, prayer, events, staff, announcements, gallery, faqs, janaza] = await Promise.all([
    db('company_settings').first(), db('prayer_settings').first(), db('events').whereNull('deleted_at'), db('staff_members').whereNull('deleted_at'), db('announcements').whereNull('deleted_at'), db('gallery_images').whereNull('deleted_at'), db('faqs').whereNull('deleted_at'), db('janaza_notices').whereNull('deleted_at')
  ]);
  const sections = [
    evaluate('মসজিদের পরিচিতি', '/settings', [settings || {}], ['company_name', 'company_address', 'company_phone', 'company_email', 'logo'], 'company_name'),
    evaluate('নামাজের সময়', '/landing/prayer-times', [prayer || {}], ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha', 'jummah', 'hijri_date'], 'venue_name'),
    evaluate('অনুষ্ঠান', '/landing/events', events, ['title_bn', 'title_en', 'description_bn', 'description_en', 'event_date', 'event_time', 'location'], 'title_bn'),
    evaluate('স্টাফ প্রোফাইল', '/landing/staff', staff, ['name_bn', 'name_en', 'position_bn', 'position_en', 'bio_bn', 'bio_en', 'photo'], 'name_bn'),
    evaluate('ঘোষণা', '/landing/announcements', announcements, ['title_bn', 'title_en', 'content_bn', 'content_en', 'publish_date'], 'title_bn'),
    evaluate('গ্যালারি', '/landing/gallery', gallery, ['title_bn', 'title_en', 'image_path'], 'title_bn', 3),
    evaluate('জিজ্ঞাসা', '/landing/faq', faqs, ['question_bn', 'question_en', 'answer_bn', 'answer_en'], 'question_bn', 3),
    evaluate('জানাযা', '/landing/janaza', janaza, ['deceased_name_bn', 'deceased_name_en', 'janaza_date', 'janaza_time', 'location_bn', 'location_en'], 'deceased_name_bn', 0),
  ];
  const score = Math.round(sections.reduce((sum, section) => sum + section.score, 0) / sections.length); const incomplete = sections.reduce((sum, section) => sum + section.incomplete, 0); const inactive = sections.reduce((sum, section) => sum + section.inactive, 0);
  return { score, incomplete, inactive, ready: sections.filter((section) => section.score === 100).length, sections };
}
module.exports = { get };
