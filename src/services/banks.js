const db = require('../config/db');
const periods = require('./accounting-periods');
const paymentGuards = require('./payment-guards');

const banks = {
  all: () => db('banks').orderBy('name'),
  active: () => db('banks').where({ is_active: true }).orderBy('name'),
  find: (id) => db('banks').where({ id }).first(),
  create: async (data) => db.transaction(async (trx) => {
    const payload = typeof data === 'string' ? { name: data } : data;
    const name = String(payload.name || '').trim();
    const openingBalance = Number(payload.opening_balance || 0);
    if (!name) throw new Error('Bank name is required');
    if (!Number.isFinite(openingBalance) || openingBalance < 0) throw new Error('Opening balance cannot be negative');
    if (openingBalance > 0 && !payload.opening_balance_date) throw new Error('Opening balance date is required');
    if (payload.opening_balance_date) await periods.assertOpen(payload.opening_balance_date, trx);
    if (payload.account_number) {
      const duplicate = await trx('banks').whereRaw('LOWER(account_number)=LOWER(?)', [String(payload.account_number).trim()]).first();
      if (duplicate) throw new Error('This bank account number already exists');
    }
    return (await trx('banks').insert({
      name,
      account_number: payload.account_number || null,
      branch_name: payload.branch_name || null,
      opening_balance: openingBalance,
      opening_balance_date: payload.opening_balance_date || null,
      is_active: true,
    }).returning('*'))[0];
  }),
  update: async (id, data) => db.transaction(async (trx) => {
    const current = await trx('banks').where({ id }).forUpdate().first();
    if (!current) throw new Error('Bank account not found');
    const name = String(data.name || '').trim();
    const openingBalance = Number(data.opening_balance || 0);
    if (!name) throw new Error('Bank name is required');
    if (!Number.isFinite(openingBalance) || openingBalance < 0) throw new Error('Opening balance cannot be negative');
    if (openingBalance > 0 && !data.opening_balance_date) throw new Error('Opening balance date is required');
    const openingChanged = Number(current.opening_balance || 0) !== openingBalance ||
      String(current.opening_balance_date || '').slice(0, 10) !== String(data.opening_balance_date || '').slice(0, 10);
    if (openingChanged) {
      const checks = [
        trx('bank_transactions').where({ bank_id: id }),
        trx('collections').where({ bank_id: id }),
        trx('expenses').where({ bank_id: id }),
        trx('mosque_loans').where({ bank_id: id }),
        trx('loan_repayments').where({ bank_id: id }),
        trx('treasury_transfers').where((q) => q.where({ from_bank_id: id }).orWhere({ to_bank_id: id })),
      ];
      for (const check of checks) {
        if (await check.first()) throw new Error('Opening balance cannot change after financial activity begins');
      }
      if (data.opening_balance_date) await periods.assertOpen(data.opening_balance_date, trx);
    }
    if (data.account_number) {
      const duplicate = await trx('banks').whereNot({ id }).whereRaw('LOWER(account_number)=LOWER(?)', [String(data.account_number).trim()]).first();
      if (duplicate) throw new Error('This bank account number already exists');
    }
    await trx('banks').where({ id }).update({
      name,
      account_number: data.account_number || null,
      branch_name: data.branch_name || null,
      opening_balance: openingBalance,
      opening_balance_date: data.opening_balance_date || null,
    });
    return trx('banks').where({ id }).first();
  }),
  setActive: async (id, active) => db.transaction(async (trx) => {
    const current = await trx('banks').where({ id }).forUpdate().first();
    if (!current) throw new Error('Bank account not found');
    if (!active) {
      const treasury = require('./treasury');
      const balance = await treasury.bankBalance(id, null, trx);
      if (Math.abs(balance) > 0.0001) throw new Error('Move or settle the bank balance before deactivating this account');
    }
    await trx('banks').where({ id }).update({ is_active: Boolean(active) });
  }),
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
  create: async (data) => db.transaction(async (trx) => {
    await periods.assertOpen(data.date, trx);
    if (!['deposit', 'withdraw'].includes(data.type)) throw new Error('Select a valid bank transaction type');
    const amount = Number(data.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('Amount must be greater than zero');
    const bankId = await paymentGuards.bankIdFor({ payment_method: 'bank', bank_id: data.bank_id }, trx);
    if (data.type === 'withdraw') {
      await paymentGuards.assertOutgoingFunds({
        payment_method: 'bank',
        bank_id: bankId,
        date: data.date,
      }, amount, trx);
    }
    const payload = clean({
      ...data,
      bank_id: bankId,
      amount,
      status: 'posted',
    });
    return (await trx('bank_transactions').insert(payload).returning('*'))[0];
  }),
  find: (id) => db('bank_transactions').where({ id }).first(),
  cancel: async (id, data) => db.transaction(async (trx) => {
    const item = await trx('bank_transactions').where({ id }).forUpdate().first();
    if (!item || item.status !== 'posted') throw new Error('Active bank transaction not found');
    if (!String(data.cancellation_reason || '').trim()) throw new Error('Cancellation reason is required');
    await periods.assertOpen(item.date, trx);
    if (item.type === 'deposit') {
      await paymentGuards.assertOutgoingFunds({
        payment_method: 'bank',
        bank_id: item.bank_id,
        date: item.date,
      }, item.amount, trx);
    }
    return trx('bank_transactions').where({ id, status: 'posted' }).update({
      status: 'cancelled',
      cancelled_at: trx.fn.now(),
      cancelled_by: data.cancelled_by,
      cancellation_reason: String(data.cancellation_reason).trim(),
      updated_at: trx.fn.now(),
    });
  }),
};

/** Net bank balance (deposits - withdrawals), optionally up to a date. */
async function balance({ upto } = {}) {
  const q = db('bank_transactions').where({ status: 'posted' }).select(
    db.raw("COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount ELSE -amount END), 0) as bal")
  );
  if (upto) q.where('date', '<=', upto);
  const [row] = await q;
  return Number(row.bal || 0);
}

module.exports = { banks, transactions, balance };
