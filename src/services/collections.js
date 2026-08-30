const db = require('../config/db');
const periods = require('./accounting-periods');
const paymentGuards = require('./payment-guards');

function clean(data) {
  const out = { ...data };
  for (const k of ['member_id', 'book_number_id', 'collection_category_id', 'bank_id', 'mobile_wallet_id', 'amount']) {
    if (out[k] === '' || out[k] === undefined) out[k] = null;
  }
  return out;
}

async function list({ from, to, status } = {}) {
  const q = db('collections as c')
    .leftJoin('members as m', 'c.member_id', 'm.id')
    .leftJoin('book_numbers as bn', 'c.book_number_id', 'bn.id')
    .leftJoin('collection_categories as cc', 'c.collection_category_id', 'cc.id')
    .leftJoin('banks as b', 'c.bank_id', 'b.id')
    .leftJoin('mobile_wallets as mw', 'c.mobile_wallet_id', 'mw.id')
    .select('c.*', 'm.name as member_name', 'm.id_no as member_id_no', 'bn.book_number as book_no', 'cc.name as category_name', 'b.name as bank_name', 'mw.name as mobile_wallet_name')
    .orderBy('c.date', 'desc')
    .orderBy('c.id', 'desc');
  if (from) q.where('c.date', '>=', from);
  if (to) q.where('c.date', '<=', to);
  if (status) q.where('c.status', status);
  return q;
}

async function create(data) {
  const payload = clean(data);
  return db.transaction(async (trx) => {
    await periods.assertOpen(payload.date, trx);
    payload.bank_id = await paymentGuards.bankIdFor(payload, trx);
    payload.mobile_wallet_id = await paymentGuards.walletIdFor(payload, trx);
    if (!payload.receipt_no) {
      const seq = await trx.raw("SELECT nextval('collection_receipt_seq') as value");
      payload.receipt_no = `RCPT-${new Date().getFullYear()}-${String(seq.rows[0].value).padStart(6, '0')}`;
    }
    const [row] = await trx('collections').insert(payload).returning('*');
    return row;
  });
}

async function find(id) {
  return db('collections').where({ id }).first();
}

async function findFull(id) {
  return db('collections as c')
    .leftJoin('members as m', 'c.member_id', 'm.id')
    .leftJoin('collection_categories as cc', 'c.collection_category_id', 'cc.id')
    .leftJoin('book_numbers as bn', 'c.book_number_id', 'bn.id')
    .leftJoin('banks as b', 'c.bank_id', 'b.id')
    .leftJoin('mobile_wallets as mw', 'c.mobile_wallet_id', 'mw.id')
    .leftJoin('users as u', 'c.created_by', 'u.id')
    .select('c.*', 'm.name as member_name', 'm.id_no as member_id_no', 'm.phone as member_phone', 'cc.name as category_name', 'bn.book_number as book_no', 'b.name as bank_name', 'mw.name as mobile_wallet_name', 'u.name as created_by_name')
    .where('c.id', id).first();
}

async function remove(id) {
  return db('collections').where({ id }).del();
}

async function cancel(id, { cancelled_by, cancellation_reason }) {
  return db.transaction(async (trx) => {
    const item = await trx('collections').where({ id }).first();
    if (item) await periods.assertOpen(item.date, trx);
    const changed = await trx('collections').where({ id, status: 'posted' }).update({
      status: 'cancelled', cancelled_at: trx.fn.now(), cancelled_by, cancellation_reason,
    });
    if (!changed) return 0;
    const payment = await trx('monthly_payments').where({ collection_id: id, status: 'posted' }).first();
    if (payment) {
      await trx('monthly_payments').where({ id: payment.id }).update({ status: 'cancelled', updated_at: trx.fn.now() });
      const totals = await trx('monthly_payments').where({ monthly_bill_id: payment.monthly_bill_id, status: 'posted' }).sum('amount as total').first();
      const bill = await trx('monthly_bills').where({ id: payment.monthly_bill_id }).first();
      const paid = Number(totals.total || 0);
      await trx('monthly_bills').where({ id: bill.id }).update({ amount_paid: paid, status: paid <= 0 ? 'unpaid' : (paid >= Number(bill.amount_due) ? 'paid' : 'partial'), updated_at: trx.fn.now() });
    }
    const pledgePayment = await trx('pledge_payments').where({ collection_id: id, status: 'posted' }).first();
    if (pledgePayment) {
      await trx('pledge_payments').where({ id: pledgePayment.id }).update({ status: 'cancelled' });
      const totals = await trx('pledge_payments').where({ pledge_id: pledgePayment.pledge_id, status: 'posted' }).sum('amount as total').first();
      const pledge = await trx('donation_pledges').where({ id: pledgePayment.pledge_id }).first();
      const paid = Number(totals.total || 0), amount = Number(pledge.pledged_amount);
      await trx('donation_pledges').where({ id: pledge.id }).update({ paid_amount: paid, status: paid <= 0 ? 'active' : (paid >= amount ? 'paid' : 'partial'), updated_at: trx.fn.now() });
    }
    const bookingPayment = await trx('facility_booking_payments').where({ collection_id: id, status: 'posted' }).first();
    if (bookingPayment) {
      await trx('facility_booking_payments').where({ id: bookingPayment.id }).update({ status: 'cancelled' });
      const totals = await trx('facility_booking_payments').where({ booking_id: bookingPayment.booking_id, status: 'posted' }).sum('amount as total').first();
      const booking = await trx('facility_bookings').where({ id: bookingPayment.booking_id }).first();
      const paid = Number(totals.total || 0);
      await trx('facility_bookings').where({ id: booking.id }).update({
        amount_paid: paid,
        payment_status: paid <= 0 ? 'unpaid' : (paid >= Number(booking.fee_amount) ? 'paid' : 'partial'),
        updated_at: trx.fn.now(),
      });
    }
    await trx('online_donation_submissions').where({ collection_id: id, status: 'verified' }).update({
      status: 'reversed',
      review_notes: trx.raw("concat_ws(E'\\n', review_notes, ?::text)", [`Receipt ${item.receipt_no} cancelled: ${cancellation_reason}`]),
      updated_at: trx.fn.now(),
    });
    return changed;
  });
}

/** Sum of collections in a date range (inclusive). */
async function total({ from, to } = {}) {
  const q = db('collections').where('status', 'posted').sum('amount as s');
  if (from) q.where('date', '>=', from);
  if (to) q.where('date', '<=', to);
  const [row] = await q;
  return Number(row.s || 0);
}

const categories = {
  all: () => db('collection_categories').where({ is_active: true }).orderBy('id'),
};

module.exports = { list, create, find, findFull, remove, cancel, total, categories };
