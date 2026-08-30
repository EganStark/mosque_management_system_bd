const db = require('../config/db');

function dhakaToday() {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const value = (type) => parts.find((part) => part.type === type).value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}

function clean(data) {
  const out = { ...data };
  delete out._csrf;
  if (out.is_active === 'on' || out.is_active === 'true' || out.is_active === true) {
    out.is_active = true;
  } else {
    out.is_active = false;
  }
  out.recurrence_type = ['none', 'weekly', 'monthly'].includes(out.recurrence_type) ? out.recurrence_type : 'none';
  if (out.recurrence_type === 'none' || !out.recurrence_until) out.recurrence_until = null;
  if (!out.end_time) out.end_time = null;
  if (!/^\d{2}:\d{2}(?::\d{2})?$/.test(String(out.event_time || ''))) {
    throw new Error('অনুষ্ঠানের শুরুর সঠিক সময় দিন।');
  }
  if (out.end_time && !/^\d{2}:\d{2}(?::\d{2})?$/.test(String(out.end_time))) {
    throw new Error('অনুষ্ঠানের শেষের সঠিক সময় দিন।');
  }
  if (out.end_time && String(out.end_time).slice(0, 5) <= String(out.event_time).slice(0, 5)) {
    throw new Error('অনুষ্ঠানের শেষের সময় শুরুর সময়ের পরে হতে হবে।');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(out.event_date || ''))) {
    throw new Error('অনুষ্ঠানের সঠিক তারিখ দিন।');
  }
  if (out.recurrence_until && !/^\d{4}-\d{2}-\d{2}$/.test(String(out.recurrence_until))) {
    throw new Error('পুনরাবৃত্তির সঠিক শেষ তারিখ দিন।');
  }
  if (out.recurrence_until && String(out.recurrence_until) < String(out.event_date)) {
    throw new Error('পুনরাবৃত্তির শেষ তারিখ অনুষ্ঠানের তারিখের আগে হতে পারবে না।');
  }
  return out;
}

function asDraft(data) { return { ...clean(data), publication_status: 'draft', published_at: null, published_by: null, scheduled_at: null, expires_at: null, review_status: 'draft', review_requested_at: null, review_requested_by: null, reviewed_at: null, reviewed_by: null, review_notes: null }; }

const events = {
  list: (filters = {}) => {
    const query = db('events').whereNull('deleted_at');
    if (['none', 'weekly', 'monthly'].includes(filters.recurrence)) {
      query.where({ recurrence_type: filters.recurrence });
    }
    if (filters.status === 'published') query.where({ publication_status: 'published', is_active: true });
    if (filters.status === 'draft') query.where({ publication_status: 'draft' });
    if (filters.status === 'inactive') query.where({ is_active: false });
    const today = dhakaToday();
    if (filters.lifecycle === 'upcoming') {
      query.where((builder) => builder
        .where('event_date', '>=', today)
        .orWhere((recurring) => recurring
          .whereIn('recurrence_type', ['weekly', 'monthly'])
          .where((ending) => ending.whereNull('recurrence_until').orWhere('recurrence_until', '>=', today))));
    }
    if (filters.lifecycle === 'past') {
      query.where((builder) => builder
        .where((oneTime) => oneTime.where({ recurrence_type: 'none' }).where('event_date', '<', today))
        .orWhere((recurring) => recurring
          .whereIn('recurrence_type', ['weekly', 'monthly'])
          .whereNotNull('recurrence_until')
          .where('recurrence_until', '<', today)));
    }
    return query.orderBy('event_date', 'desc').orderBy('event_time', 'desc');
  },
  listActive: () => db('events').whereNull('deleted_at').where({ is_active: true, publication_status: 'published' }).orderBy('event_date', 'asc').orderBy('event_time', 'asc'),
  find: (id) => db('events').where({ id }).whereNull('deleted_at').first(),
  create: async (data) => (await db('events').insert(asDraft(data)).returning('*'))[0],
  update: async (id, data) => {
    await db('events').where({ id }).update({ ...asDraft(data), updated_at: db.fn.now() });
    return db('events').where({ id }).first();
  },
  remove: (id) => db('events').where({ id }).del(),
};

module.exports = events;
