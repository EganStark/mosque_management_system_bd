const db = require('../config/db');

const banks = {
  all: () => db('banks').orderBy('name'),
  find: (id) => db('banks').where({ id }).first(),
  create: async (name) => (await db('banks').insert({ name }).returning('*'))[0],
  update: async (id, name) => {
    await db('banks').where({ id }).update({ name });
    return db('banks').where({ id }).first();
  },
  remove: (id) => db('banks').where({ id }).del(),
};

function clean(data) {
  const out = { ...data };
  for (const k of ['bank_id', 'amount']) {
    if (out[k] === '' || out[k] === undefined) out[k] = null;
  }
  return out;
}

const transactions = {
  list: ({ from, to, bank_id } = {}) => {
    const q = db('bank_transactions as t')
      .leftJoin('banks as b', 't.bank_id', 'b.id')
      .select('t.*', 'b.name as bank_name')
      .orderBy('t.date', 'desc')
      .orderBy('t.id', 'desc');
    if (from) q.where('t.date', '>=', from);
    if (to) q.where('t.date', '<=', to);
    if (bank_id) q.where('t.bank_id', bank_id);
    return q;
  },
  create: async (data) => (await db('bank_transactions').insert(clean(data)).returning('*'))[0],
  find: (id) => db('bank_transactions').where({ id }).first(),
  remove: (id) => db('bank_transactions').where({ id }).del(),
};

/** Net bank balance (deposits - withdrawals), optionally up to a date. */
async function balance({ upto } = {}) {
  const q = db('bank_transactions').select(
    db.raw("COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount ELSE -amount END), 0) as bal")
  );
  if (upto) q.where('date', '<=', upto);
  const [row] = await q;
  return Number(row.bal || 0);
}

module.exports = { banks, transactions, balance };
