const db = require('../config/db');
const periods = require('./accounting-periods');
const paymentGuards = require('./payment-guards');
const { assertIndependentApproval } = require('./approval-separation');

async function list({ status } = {}) {
  const q = db('mosque_loans as l').leftJoin('members as m', 'l.member_id', 'm.id')
    .select('l.*', 'm.id_no as member_no').orderBy('l.issue_date', 'desc').orderBy('l.id', 'desc');
  if (status && ['pending', 'active', 'overdue', 'paid', 'rejected', 'cancelled'].includes(status)) q.where('l.status', status);
  return q;
}

async function summary() {
  const row = await db('mosque_loans').whereIn('status', ['active', 'overdue', 'paid']).first(
    db.raw('COUNT(*) FILTER (WHERE status IN (\'active\',\'overdue\'))::int AS active'),
    db.raw("COUNT(*) FILTER (WHERE status IN ('active','overdue') AND final_due_date < CURRENT_DATE)::int AS overdue"),
    db.raw('COALESCE(SUM(principal_amount),0) AS issued'),
    db.raw('COALESCE(SUM(repaid_amount),0) AS repaid'),
    db.raw("COALESCE(SUM(principal_amount-repaid_amount) FILTER (WHERE status IN ('active','overdue')),0) AS outstanding")
  );
  return Object.fromEntries(Object.entries(row).map(([k, v]) => [k, Number(v || 0)]));
}

async function submit(data, userId) {
  return db.transaction(async (trx) => {
    const bankId = await paymentGuards.bankIdFor(data, trx);
    const walletId = await paymentGuards.walletIdFor(data, trx);
    const amount = Number(data.principal_amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('ঋণের পরিমাণ সঠিক নয়');
    const seq = await trx.raw("SELECT nextval('mosque_loan_no_seq') AS value");
    const [row] = await trx('mosque_loans').insert({
      loan_no: `LOAN-${new Date().getFullYear()}-${String(seq.rows[0].value).padStart(6, '0')}`,
      member_id: data.member_id || null, borrower_name: data.borrower_name, phone: data.phone || null,
      address: data.address || null, purpose: data.purpose, principal_amount: amount,
      installment_amount: data.installment_amount || null, issue_date: data.issue_date,
      first_due_date: data.first_due_date || null, final_due_date: data.final_due_date || null,
      payment_method: data.payment_method, bank_id: bankId, mobile_wallet_id: walletId,
      reference: data.reference || null, guarantor_name: data.guarantor_name || null,
      guarantor_phone: data.guarantor_phone || null, notes: data.notes || null,
      created_by: userId, submitted_by: userId, submitted_at: trx.fn.now(), status: 'pending',
    }).returning('*');
    return row;
  });
}

async function decide(id, decision, notes, actorId) {
  if (!['approve', 'reject'].includes(decision)) throw new Error('Invalid loan decision');
  return db.transaction(async (trx) => {
    const loan = await trx('mosque_loans').where({ id }).forUpdate().first();
    if (!loan) throw new Error('Loan not found');
    if (loan.status !== 'pending') throw new Error('Only a pending loan can be reviewed');
    if (decision === 'approve') await assertIndependentApproval(trx, loan.submitted_by, actorId, 'loan application');
    if (decision === 'reject') {
      await trx('mosque_loans').where({ id }).update({
        status: 'rejected', rejected_by: actorId, rejected_at: trx.fn.now(),
        decision_notes: String(notes || '').trim() || null, updated_at: trx.fn.now(),
      });
    } else {
      await periods.assertOpen(loan.issue_date, trx);
      await paymentGuards.assertOutgoingFunds(loan, loan.principal_amount, trx);
      await trx('mosque_loans').where({ id }).update({
        status: 'active', approved_by: actorId, approved_at: trx.fn.now(),
        decision_notes: String(notes || '').trim() || null, updated_at: trx.fn.now(),
      });
    }
    return trx('mosque_loans').where({ id }).first();
  });
}

async function create(data, userId) {
  return db.transaction(async (trx) => {
    await periods.assertOpen(data.issue_date, trx);
    const bankId = await paymentGuards.bankIdFor(data, trx);
    const walletId = await paymentGuards.walletIdFor(data, trx);
    const amount = Number(data.principal_amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('ঋণের পরিমাণ সঠিক নয়');
    await paymentGuards.assertOutgoingFunds({
      payment_method: data.payment_method,
      bank_id: bankId,
      mobile_wallet_id: walletId,
      date: data.issue_date,
    }, amount, trx);
    const seq = await trx.raw("SELECT nextval('mosque_loan_no_seq') AS value");
    const [row] = await trx('mosque_loans').insert({
      loan_no: `LOAN-${new Date().getFullYear()}-${String(seq.rows[0].value).padStart(6, '0')}`,
      member_id: data.member_id || null, borrower_name: data.borrower_name, phone: data.phone || null,
      address: data.address || null, purpose: data.purpose, principal_amount: amount,
      installment_amount: data.installment_amount || null, issue_date: data.issue_date,
      first_due_date: data.first_due_date || null, final_due_date: data.final_due_date || null,
      payment_method: data.payment_method, bank_id: bankId, mobile_wallet_id: walletId,
      reference: data.reference || null, guarantor_name: data.guarantor_name || null,
      guarantor_phone: data.guarantor_phone || null, notes: data.notes || null, created_by: userId,
    }).returning('*');
    return row;
  });
}

async function find(id) {
  const item = await db('mosque_loans as l').leftJoin('members as m', 'l.member_id', 'm.id')
    .leftJoin('banks as b', 'l.bank_id', 'b.id').leftJoin('mobile_wallets as mw', 'l.mobile_wallet_id', 'mw.id')
    .select('l.*', 'm.id_no as member_no', 'b.name as bank_name', 'mw.name as mobile_wallet_name', 'mw.account_number as mobile_wallet_number').where('l.id', id).first();
  if (!item) return null;
  item.repayments = await db('loan_repayments as r').leftJoin('banks as b', 'r.bank_id', 'b.id').leftJoin('mobile_wallets as mw', 'r.mobile_wallet_id', 'mw.id').leftJoin('users as u', 'r.received_by', 'u.id')
    .select('r.*', 'b.name as bank_name', 'mw.name as mobile_wallet_name', 'mw.account_number as mobile_wallet_number', 'u.name as received_by_name').where('r.loan_id', id).orderBy('r.payment_date', 'desc').orderBy('r.id', 'desc');
  return item;
}

async function repay(id, data, userId) {
  return db.transaction(async (trx) => {
    await periods.assertOpen(data.payment_date, trx);
    const bankId = await paymentGuards.bankIdFor(data, trx);
    const walletId = await paymentGuards.walletIdFor(data, trx);
    const loan = await trx('mosque_loans').where({ id }).forUpdate().first();
    if (!loan || !['active', 'overdue'].includes(loan.status)) throw new Error('এই ঋণে কিস্তি গ্রহণ করা যাবে না');
    const amount = Number(data.amount), balance = Number(loan.principal_amount) - Number(loan.repaid_amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > balance) throw new Error('কিস্তির পরিমাণ বকেয়া সীমার মধ্যে দিন');
    await trx('loan_repayments').insert({ loan_id: id, amount, payment_date: data.payment_date, payment_method: data.payment_method,
      bank_id: bankId, mobile_wallet_id: walletId, reference: data.reference || null, remarks: data.remarks || null, received_by: userId });
    const total = Number(loan.repaid_amount) + amount;
    await trx('mosque_loans').where({ id }).update({ repaid_amount: total, status: total >= Number(loan.principal_amount) ? 'paid' : 'active', updated_at: trx.fn.now() });
  });
}

async function cancelRepayment(id, reason, userId) {
  return db.transaction(async (trx) => {
    const repayment = await trx('loan_repayments').where({ id }).forUpdate().first();
    if (!repayment || repayment.status !== 'posted') throw new Error('Active repayment not found');
    const loan = await trx('mosque_loans').where({ id: repayment.loan_id }).forUpdate().first();
    if (!loan || loan.status === 'cancelled') throw new Error('Loan not found');
    if (!String(reason || '').trim()) throw new Error('Cancellation reason is required');
    await periods.assertOpen(repayment.payment_date, trx);
    await paymentGuards.assertOutgoingFunds({
      payment_method: repayment.payment_method,
      bank_id: repayment.bank_id,
      mobile_wallet_id: repayment.mobile_wallet_id,
      date: repayment.payment_date,
    }, repayment.amount, trx);
    await trx('loan_repayments').where({ id, status: 'posted' }).update({
      status: 'cancelled',
      cancelled_at: trx.fn.now(),
      cancelled_by: userId,
      cancellation_reason: String(reason).trim(),
    });
    const total = Math.max(0, Number(loan.repaid_amount) - Number(repayment.amount));
    const overdue = loan.final_due_date && String(loan.final_due_date).slice(0, 10) < new Date().toISOString().slice(0, 10);
    await trx('mosque_loans').where({ id: loan.id }).update({
      repaid_amount: total,
      status: overdue ? 'overdue' : 'active',
      updated_at: trx.fn.now(),
    });
  });
}

async function cancel(id, reason, userId) {
  return db.transaction(async (trx) => {
    const loan = await trx('mosque_loans').where({ id }).forUpdate().first();
    if (!loan) throw new Error('Loan not found');
    if (loan.status === 'cancelled') throw new Error('Loan is already cancelled');
    if (loan.status === 'paid' || Number(loan.repaid_amount) > 0)
      throw new Error('A loan with repayments cannot be cancelled');
    if (!String(reason || '').trim()) throw new Error('Cancellation reason is required');
    await periods.assertOpen(loan.issue_date, trx);
    await trx('mosque_loans').where({ id }).update({
      status: 'cancelled',
      cancelled_at: trx.fn.now(),
      cancelled_by: userId,
      cancellation_reason: String(reason).trim(),
      updated_at: trx.fn.now(),
    });
  });
}

async function refreshOverdue() {
  await db('mosque_loans').where({ status: 'active' }).whereNotNull('final_due_date').where('final_due_date', '<', db.fn.now()).update({ status: 'overdue', updated_at: db.fn.now() });
}

module.exports = { list, summary, create, submit, decide, find, repay, cancelRepayment, cancel, refreshOverdue };
