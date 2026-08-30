const db = require('../config/db');

function clean(data) {
  const out = { ...data };
  delete out._csrf;
  if (out.is_active === 'on' || out.is_active === 'true' || out.is_active === true) {
    out.is_active = true;
  } else {
    out.is_active = false;
  }
  out.show_on_website = out.show_on_website === 'on' || out.show_on_website === 'true' || out.show_on_website === true;
  for (const key of ['member_id', 'joining_date', 'leaving_date', 'monthly_allowance', 'basic_salary']) {
    if (out[key] === '' || out[key] === undefined) out[key] = null;
  }
  if (out.sort_order) {
    out.sort_order = parseInt(out.sort_order, 10) || 0;
  }
  return out;
}

function asDraft(data) { return { ...clean(data), publication_status: 'draft', published_at: null, published_by: null, scheduled_at: null, expires_at: null, review_status: 'draft', review_requested_at: null, review_requested_by: null, reviewed_at: null, reviewed_by: null, review_notes: null }; }

const staff = {
  list: () => db('staff_members').whereNull('deleted_at').orderBy('sort_order', 'asc').orderBy('id', 'asc'),
  listActive: () => db('staff_members').whereNull('deleted_at').where({ is_active: true, show_on_website: true, publication_status: 'published' }).orderBy('sort_order', 'asc').orderBy('id', 'asc'),
  find: (id) => db('staff_members').where({ id }).whereNull('deleted_at').first(),
  create: async (data) => (await db('staff_members').insert(asDraft(data)).returning('*'))[0],
  update: async (id, data) => {
    await db('staff_members').where({ id }).update({ ...asDraft(data), updated_at: db.fn.now() });
    return db('staff_members').where({ id }).first();
  },
  remove: (id) => db('staff_members').where({ id }).del(),
};

module.exports = staff;
