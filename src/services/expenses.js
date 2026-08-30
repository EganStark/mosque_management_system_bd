const db = require('../config/db');

function clean(data) {
  const out = { ...data };
  for (const k of ['expense_head_id', 'unit', 'rate', 'amount']) {
    if (out[k] === '' || out[k] === undefined) out[k] = null;
  }
  return out;
}

const heads = {
  all: () => db('expense_heads').orderBy('name'),
  find: (id) => db('expense_heads').where({ id }).first(),
  create: async (data) => (await db('expense_heads').insert(data).returning('*'))[0],
  update: async (id, data) => {
    await db('expense_heads').where({ id }).update(data);
    return db('expense_heads').where({ id }).first();
  },
  remove: (id) => db('expense_heads').where({ id }).del(),
};

async function list({ from, to, expense_head_id } = {}) {
  const q = db('expenses as e')
    .leftJoin('expense_heads as h', 'e.expense_head_id', 'h.id')
    .select('e.*', 'h.name as head_name')
    .orderBy('e.date', 'desc')
    .orderBy('e.id', 'desc');
  if (from) q.where('e.date', '>=', from);
  if (to) q.where('e.date', '<=', to);
  if (expense_head_id) q.where('e.expense_head_id', expense_head_id);
  return q;
}

async function create(data) {
  const [row] = await db('expenses').insert(clean(data)).returning('*');
  return row;
}

async function find(id) {
  return db('expenses').where({ id }).first();
}

async function remove(id) {
  return db('expenses').where({ id }).del();
}

async function total({ from, to } = {}) {
  const q = db('expenses').sum('amount as s');
  if (from) q.where('date', '>=', from);
  if (to) q.where('date', '<=', to);
  const [row] = await q;
  return Number(row.s || 0);
}

module.exports = { heads, list, create, find, remove, total };
