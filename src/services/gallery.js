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

const gallery = {
  list: () => db('gallery_images').whereNull('deleted_at').orderBy('sort_order', 'asc').orderBy('id', 'asc'),
  listActive: () => db('gallery_images').whereNull('deleted_at').where({ is_active: true, publication_status: 'published' }).orderBy('sort_order', 'asc').orderBy('id', 'asc'),
  find: (id) => db('gallery_images').where({ id }).whereNull('deleted_at').first(),
  create: async (data) => (await db('gallery_images').insert(asDraft(data)).returning('*'))[0],
  update: async (id, data) => {
    await db('gallery_images').where({ id }).update({ ...asDraft(data), updated_at: db.fn.now() });
    return db('gallery_images').where({ id }).first();
  },
  move: async (id, direction) => db.transaction(async (trx) => {
    if (!['up', 'down'].includes(direction)) throw new Error('Invalid gallery direction');
    const rows = await trx('gallery_images')
      .whereNull('deleted_at')
      .select('id')
      .orderBy('sort_order', 'asc')
      .orderBy('id', 'asc');
    const current = rows.findIndex((row) => Number(row.id) === Number(id));
    if (current < 0) throw new Error('Gallery image not found');
    const target = direction === 'up' ? current - 1 : current + 1;
    if (target < 0 || target >= rows.length) return false;
    [rows[current], rows[target]] = [rows[target], rows[current]];
    for (let index = 0; index < rows.length; index += 1) {
      await trx('gallery_images')
        .where({ id: rows[index].id })
        .update({ sort_order: index + 1, updated_at: trx.fn.now() });
    }
    return true;
  }),
  remove: (id) => db('gallery_images').where({ id }).del(),
};

module.exports = gallery;
