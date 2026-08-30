const db = require('../config/db');

const DEFAULTS = {
  fajr: '04:30',
  dhuhr: '12:15',
  asr: '15:45',
  maghrib: '18:25',
  isha: '19:55',
  jummah: '13:15',
  fajr_start: '04:10',
  asr_start: '15:30',
  maghrib_start: '18:25',
  isha_start: '19:45',
  sahri_end: '04:20',
  iftar_time: '18:25',
  sunrise: '05:48',
  fajr_end: '05:45',
  dhuhr_start: '12:05',
  dhuhr_end: '15:40',
  asr_end: '18:20',
  maghrib_end: '19:50',
  isha_end: '04:15',
  sunrise_forbidden_end: '06:08',
  zawal_start: '11:55',
  zawal_end: '12:05',
  sunset_forbidden_start: '18:15',
  hijri_date: '17 Dhul-Hijjah 1447',
  venue_name: 'বায়তুর রহমান জামে মসজিদ',
  venue_address: 'ঢাকা, বাংলাদেশ',
  venue_phone: '+880 1234-567890',
};

async function get() {
  const row = await db('prayer_settings').orderBy('id').first();
  return row || { id: null, ...DEFAULTS };
}

async function upsert(data) {
  const values = { ...data };
  delete values._csrf;
  const existing = await db('prayer_settings').orderBy('id').first();
  if (existing) {
    await db('prayer_settings')
      .where({ id: existing.id })
      .update({ ...values, updated_at: db.fn.now() });
    return existing.id;
  }
  const [row] = await db('prayer_settings').insert(values).returning('id');
  return row.id || row;
}

module.exports = { get, upsert, DEFAULTS };
