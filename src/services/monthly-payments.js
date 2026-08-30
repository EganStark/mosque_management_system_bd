const db = require('../config/db');
const periods = require('./accounting-periods');
const paymentGuards = require('./payment-guards');

function normalizeMonth(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})/);
  if (!match) return null;
  return `${match[1]}-${match[2]}-01`;
}

async function generate(month, userId) {
  const billingMonth = normalizeMonth(month);
  if (!billingMonth) throw new Error('Invalid billing month');
  return db.transaction(async (trx) => {
    const members = await trx('members')
      .where({ monthly_payment: true, status: 'active' })
      .whereNull('die_date')
      .where('monthly_payment_amount', '>', 0)
      .select('id', 'monthly_payment_amount');
    if (!members.length) return 0;
    const rows = members.map((m) => ({
      member_id: m.id,
      billing_month: billingMonth,
      amount_due: m.monthly_payment_amount,
      amount_paid: 0,
      status: 'unpaid',
      generated_by: userId,
    }));
    const inserted = await trx('monthly_bills')
      .insert(rows)
      .onConflict(['member_id', 'billing_month'])
      .ignore()
      .returning('id');
    return inserted.length;
  });
}

async function list(month) {
  const billingMonth = normalizeMonth(month);
  const q = db('monthly_bills as mb')
    .join('members as m', 'mb.member_id', 'm.id')
    .select('mb.*', 'm.name as member_name', 'm.id_no as member_id_no', 'm.phone')
    .orderBy('m.id_no');
  if (billingMonth) q.where('mb.billing_month', billingMonth);
  return q;
}

async function find(id) {
  return db('monthly_bills as mb')
    .join('members as m', 'mb.member_id', 'm.id')
    .select('mb.*', 'm.name as member_name', 'm.id_no as member_id_no', 'm.phone')
    .where('mb.id', id).first();
}

async function paymentsForBill(id) {
  return db('monthly_payments as mp')
    .join('collections as c', 'mp.collection_id', 'c.id')
    .select('mp.*', 'c.receipt_no', 'c.payment_method', 'c.transaction_reference')
    .where('mp.monthly_bill_id', id)
    .orderBy('mp.payment_date', 'desc');
}

async function recordPayment(billId, data, userId) {
  return db.transaction(async (trx) => {
    await periods.assertOpen(data.payment_date, trx);
    const bankId = await paymentGuards.bankIdFor(data, trx);
    const walletId = await paymentGuards.walletIdFor(data, trx);
    const bill = await trx('monthly_bills').where({ id: billId }).forUpdate().first();
    if (!bill) throw new Error('Monthly bill not found');
    const outstanding = Number(bill.amount_due) - Number(bill.amount_paid);
    const amount = Number(data.amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > outstanding) throw new Error('Payment must be within the outstanding amount');
    const category = await trx('collection_categories').where({ code: 'monthly' }).first();
    const [collection] = await trx('collections').insert({
      member_id: bill.member_id,
      collection_category_id: category ? category.id : null,
      purpose: `Monthly subscription ${String(bill.billing_month).slice(0, 7)}`,
      amount,
      date: data.payment_date,
      payment_method: data.payment_method,
      bank_id: bankId,
      mobile_wallet_id: walletId,
      transaction_reference: data.transaction_reference || null,
      receipt_no: data.receipt_no || null,
      remarks: data.remarks || null,
      status: 'posted',
      created_by: userId,
    }).returning('*');
    await trx('monthly_payments').insert({ monthly_bill_id: bill.id, collection_id: collection.id, amount, payment_date: data.payment_date });
    const paid = Number(bill.amount_paid) + amount;
    await trx('monthly_bills').where({ id: bill.id }).update({ amount_paid: paid, status: paid >= Number(bill.amount_due) ? 'paid' : 'partial', updated_at: trx.fn.now() });
    return collection;
  });
}

async function summary(month) {
  const billingMonth = normalizeMonth(month);
  const q = db('monthly_bills').whereNot({ status: 'cancelled' });
  if (billingMonth) q.where('billing_month', billingMonth);
  const [row] = await q.select(db.raw('COUNT(*)::int as bill_count'), db.raw('COALESCE(SUM(amount_due),0) as total_due'), db.raw('COALESCE(SUM(amount_paid),0) as total_paid'), db.raw('COALESCE(SUM(amount_due - amount_paid),0) as outstanding'));
  return { billCount: Number(row.bill_count || 0), totalDue: Number(row.total_due || 0), totalPaid: Number(row.total_paid || 0), outstanding: Number(row.outstanding || 0) };
}

async function dashboardSummary(month) {
  const normalized = normalizeMonth(month);
  if (normalized) return summary(normalized);
  const now = new Date();
  return summary(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
}

module.exports = { normalizeMonth, generate, list, find, paymentsForBill, recordPayment, summary, dashboardSummary };
