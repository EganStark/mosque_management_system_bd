const db = require('../config/db');

function clean(data) {
  const out = { ...data };
  delete out._csrf;
  if (out.is_active === 'on' || out.is_active === 'true' || out.is_active === true) {
    out.is_active = true;
  } else {
    out.is_active = false;
  }
  return out;
}

function asDraft(data) { return { ...clean(data), publication_status: 'draft', published_at: null, published_by: null, scheduled_at: null, expires_at: null, review_status: 'draft', review_requested_at: null, review_requested_by: null, reviewed_at: null, reviewed_by: null, review_notes: null }; }

const announcements = {
  list: () => db('announcements').whereNull('deleted_at').orderBy('publish_date', 'desc').orderBy('id', 'desc'),
  listActive: () => db('announcements').whereNull('deleted_at').where({ is_active: true, publication_status: 'published' }).orderBy('publish_date', 'desc').orderBy('id', 'desc'),
  find: (id) => db('announcements').where({ id }).whereNull('deleted_at').first(),
  create: async (data) => (await db('announcements').insert(asDraft(data)).returning('*'))[0],
  update: async (id, data) => {
    await db('announcements').where({ id }).update({ ...asDraft(data), updated_at: db.fn.now() });
    return db('announcements').where({ id }).first();
  },
  remove: (id) => db('announcements').where({ id }).del(),
};

module.exports = announcements;
