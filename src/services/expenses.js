const db = require('../config/db');
const periods = require('./accounting-periods');
const paymentGuards = require('./payment-guards');
const { assertIndependentApproval } = require('./approval-separation');

function clean(data) {
  const out = { ...data };
  for (const k of ['expense_head_id', 'bank_id', 'mobile_wallet_id', 'unit', 'rate', 'amount']) {
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

async function list({ from, to, expense_head_id, status } = {}) {
  const q = db('expenses as e')
    .leftJoin('expense_heads as h', 'e.expense_head_id', 'h.id')
    .leftJoin('banks as b', 'e.bank_id', 'b.id')
    .leftJoin('mobile_wallets as mw', 'e.mobile_wallet_id', 'mw.id')
    .select('e.*', 'h.name as head_name', 'b.name as bank_name', 'mw.name as mobile_wallet_name')
    .orderBy('e.date', 'desc')
    .orderBy('e.id', 'desc');
  if (from) q.where('e.date', '>=', from);
  if (to) q.where('e.date', '<=', to);
  if (expense_head_id) q.where('e.expense_head_id', expense_head_id);
  if (status) q.where('e.status', status);
  const rows = await q;
  await Promise.all(rows.filter((row) => row.status === 'pending').map(async (row) => { row.budget_position = await budgetPosition(row); }));
  return rows;
}

async function create(data) {
  const payload = clean(data);
  return db.transaction(async (trx) => {
    await periods.assertOpen(payload.date, trx);
    payload.bank_id = await paymentGuards.bankIdFor(payload, trx);
    payload.mobile_wallet_id = await paymentGuards.walletIdFor(payload, trx);
    if (payload.status !== 'pending') {
      await paymentGuards.assertOutgoingFunds(payload, payload.amount, trx);
      payload.status = 'posted';
    } else {
      payload.submitted_by = payload.submitted_by || payload.created_by;
      payload.submitted_at = trx.fn.now();
    }
    if (!payload.voucher_no) {
      const seq = await trx.raw("SELECT nextval('expense_voucher_seq') as value");
      payload.voucher_no = `VCHR-${new Date().getFullYear()}-${String(seq.rows[0].value).padStart(6, '0')}`;
    }
    const [row] = await trx('expenses').insert(payload).returning('*');
    return row;
  });
}

async function find(id) {
  return db('expenses').where({ id }).first();
}

function monthBounds(date) {
  const value = date instanceof Date ? date.toISOString().slice(0, 10) : String(date || '');
  const match = value.match(/^(\d{4})-(\d{2})/);
  if (!match) throw new Error('Invalid expense date');
  const year = Number(match[1]), month = Number(match[2]);
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const end = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`;
  return { start, end };
}

async function budgetPosition(item, trx = db) {
  if (!item.expense_head_id) return null;
  const { start, end } = monthBounds(item.date);
  const target = await trx('management_targets').where({ target_month: start }).first();
  if (!target) return null;
  const line = await trx('budget_lines').where({ management_target_id: target.id, line_type: 'expense', expense_head_id: item.expense_head_id }).first();
  if (!line) return null;
  const spent = Number((await trx('expenses').where({ expense_head_id: item.expense_head_id, status: 'posted' }).where('date', '>=', start).where('date', '<', end).sum('amount as total').first()).total || 0);
  const budget = Number(line.budget_amount || 0), requested = Number(item.amount || 0);
  return { budget, spent, requested, remaining: budget - spent, exceeds: spent + requested > budget };
}

async function decide(id, decision, notes, actorId, options = {}) {
  if (!['approve', 'reject'].includes(decision)) throw new Error('Invalid expense decision');
  return db.transaction(async (trx) => {
    const item = await trx('expenses').where({ id }).forUpdate().first();
    if (!item) throw new Error('Expense not found');
    if (item.status !== 'pending') throw new Error('Only a pending expense can be reviewed');
    if (decision === 'approve') await assertIndependentApproval(trx, item.submitted_by, actorId, 'expense');
    if (decision === 'reject') {
      await trx('expenses').where({ id }).update({
        status: 'rejected', rejected_by: actorId, rejected_at: trx.fn.now(),
        decision_notes: String(notes || '').trim() || null,
      });
    } else {
      await periods.assertOpen(item.date, trx);
      const position = await budgetPosition(item, trx);
      const overrideReason = String(options.budget_override_reason || '').trim();
      if (position?.exceeds && !overrideReason) throw new Error(`Expense exceeds this budget line by ${(position.spent + position.requested - position.budget).toFixed(2)}; enter an override reason`);
      await paymentGuards.assertOutgoingFunds(item, item.amount, trx);
      await trx('expenses').where({ id }).update({
        status: 'posted', approved_by: actorId, approved_at: trx.fn.now(),
        decision_notes: String(notes || '').trim() || null,
        budget_amount_at_approval: position ? position.budget : null,
        budget_spent_before: position ? position.spent : null,
        budget_override_reason: position?.exceeds ? overrideReason : null,
      });
    }
    return trx('expenses').where({ id }).first();
  });
}

async function findFull(id) {
  return db('expenses as e').leftJoin('expense_heads as h', 'e.expense_head_id', 'h.id').leftJoin('banks as b', 'e.bank_id', 'b.id').leftJoin('mobile_wallets as mw', 'e.mobile_wallet_id', 'mw.id').leftJoin('users as u', 'e.created_by', 'u.id')
    .select('e.*', 'h.name as head_name', 'b.name as bank_name', 'mw.name as mobile_wallet_name', 'u.name as created_by_name').where('e.id', id).first();
}

async function remove(id) {
  return db('expenses').where({ id }).del();
}

async function cancel(id, { cancelled_by, cancellation_reason }) {
  return db.transaction(async (trx) => {
    const item = await trx('expenses').where({ id }).forUpdate().first();
    if (!item) return 0;
    await periods.assertOpen(item.date, trx);
    const changed = await trx('expenses').where({ id, status: 'posted' }).update({
      status: 'cancelled', cancelled_at: trx.fn.now(), cancelled_by, cancellation_reason,
    });
    if (!changed) return 0;

    const payrollPayment = await trx('staff_payroll_payments').where({ expense_id: id, status: 'posted' }).first();
    if (payrollPayment) {
      await trx('staff_payroll_payments').where({ id: payrollPayment.id }).update({ status: 'cancelled' });
      await trx('staff_payroll_payment_requests').where({ payroll_payment_id: payrollPayment.id, status: 'approved' }).update({ status: 'cancelled' });
      const totals = await trx('staff_payroll_payments').where({ payroll_id: payrollPayment.payroll_id, status: 'posted' }).sum('amount as total').first();
      const payroll = await trx('staff_payrolls').where({ id: payrollPayment.payroll_id }).first();
      const paid = Number(totals.total || 0);
      await trx('staff_payrolls').where({ id: payroll.id }).update({ amount_paid: paid, status: paid <= 0 ? 'unpaid' : (paid >= Number(payroll.net_payable) ? 'paid' : 'partial'), updated_at: trx.fn.now() });
    }

    const welfarePayment = await trx('welfare_disbursements').where({ expense_id: id, status: 'posted' }).first();
    if (welfarePayment) {
      await trx('welfare_disbursements').where({ id: welfarePayment.id }).update({ status: 'cancelled' });
      await trx('welfare_disbursement_requests').where({ disbursement_id: welfarePayment.id, status: 'approved' }).update({ status: 'cancelled' });
      const totals = await trx('welfare_disbursements').where({ application_id: welfarePayment.application_id, status: 'posted' }).sum('amount as total').first();
      const application = await trx('welfare_applications').where({ id: welfarePayment.application_id }).first();
      const paid = Number(totals.total || 0);
      await trx('welfare_applications').where({ id: application.id }).update({ disbursed_amount: paid, status: paid <= 0 ? 'approved' : (paid >= Number(application.approved_amount) ? 'paid' : 'partial'), updated_at: trx.fn.now() });
    }

    const purchasePayment = await trx('purchase_payments').where({ expense_id: id, status: 'posted' }).first();
    if (purchasePayment) {
      await trx('purchase_payments').where({ id: purchasePayment.id }).update({ status: 'cancelled' });
      await trx('purchase_payment_requests').where({ purchase_payment_id: purchasePayment.id, status: 'approved' }).update({ status: 'cancelled' });
      const totals = await trx('purchase_payments').where({ purchase_order_id: purchasePayment.purchase_order_id, status: 'posted' }).sum('amount as total').first();
      const order = await trx('purchase_orders').where({ id: purchasePayment.purchase_order_id }).first();
      const paid = Number(totals.total || 0);
      await trx('purchase_orders').where({ id: order.id }).update({ status: paid >= Number(order.order_total) ? 'paid' : 'received', updated_at: trx.fn.now() });
    }

    await trx('maintenance_work_orders').where({ expense_id: id }).update({ expense_id: null, updated_at: trx.fn.now() });
    return changed;
  });
}

async function total({ from, to } = {}) {
  const q = db('expenses').where('status', 'posted').sum('amount as s');
  if (from) q.where('date', '>=', from);
  if (to) q.where('date', '<=', to);
  const [row] = await q;
  return Number(row.s || 0);
}

module.exports = { heads, list, create, find, findFull, remove, decide, cancel, total, budgetPosition };
