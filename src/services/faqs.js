const db = require('../config/db');

function clean(data) {
  const out = { ...data };
  delete out._csrf;
  if (out.is_active === 'on' || out.is_active === 'true' || out.is_active === true) {
    out.is_active = true;
  } else {
    out.is_active = false;
  }
  if (out.sort_order) {
    out.sort_order = parseInt(out.sort_order, 10) || 0;
  }
  return out;
}

function asDraft(data) { return { ...clean(data), publication_status: 'draft', published_at: null, published_by: null, scheduled_at: null, expires_at: null, review_status: 'draft', review_requested_at: null, review_requested_by: null, reviewed_at: null, reviewed_by: null, review_notes: null }; }

const faqs = {
  list: () => db('faqs').whereNull('deleted_at').orderBy('sort_order', 'asc').orderBy('id', 'asc'),
  listActive: () => db('faqs').whereNull('deleted_at').where({ is_active: true, publication_status: 'published' }).orderBy('sort_order', 'asc').orderBy('id', 'asc'),
  find: (id) => db('faqs').where({ id }).whereNull('deleted_at').first(),
  create: async (data) => (await db('faqs').insert(asDraft(data)).returning('*'))[0],
  update: async (id, data) => {
    await db('faqs').where({ id }).update({ ...asDraft(data), updated_at: db.fn.now() });
    return db('faqs').where({ id }).first();
  },
  remove: (id) => db('faqs').where({ id }).del(),
};

module.exports = faqs;
