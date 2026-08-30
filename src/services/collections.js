const db = require('../config/db');

function clean(data) {
  const out = { ...data };
  for (const k of ['book_number_id', 'amount']) {
    if (out[k] === '' || out[k] === undefined) out[k] = null;
  }
  return out;
}

async function list({ from, to } = {}) {
  const q = db('collections as c')
    .leftJoin('members as m', 'c.member_id', 'm.id')
    .leftJoin('book_numbers as bn', 'c.book_number_id', 'bn.id')
    .select('c.*', 'm.name as member_name', 'm.id_no as member_id_no', 'bn.book_number as book_no')
    .orderBy('c.date', 'desc')
    .orderBy('c.id', 'desc');
  if (from) q.where('c.date', '>=', from);
  if (to) q.where('c.date', '<=', to);
  return q;
}

async function create(data) {
  const [row] = await db('collections').insert(clean(data)).returning('*');
  return row;
}

async function find(id) {
  return db('collections').where({ id }).first();
}

async function remove(id) {
  return db('collections').where({ id }).del();
}

/** Sum of collections in a date range (inclusive). */
async function total({ from, to } = {}) {
  const q = db('collections').sum('amount as s');
  if (from) q.where('date', '>=', from);
  if (to) q.where('date', '<=', to);
  const [row] = await q;
  return Number(row.s || 0);
}

module.exports = { list, create, find, remove, total };
