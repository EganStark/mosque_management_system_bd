const crypto = require('crypto');
const db = require('../config/db');

function month(date) {
  if (date instanceof Date && !Number.isNaN(date.getTime())) return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-01`;
  const match = String(date || '').match(/^(\d{4})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-01` : null;
}
function checksum(value) { return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function nextMonth(period) { const [y, m] = period.split('-').map(Number); return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`; }
async function assertOpen(date, connection = db) { const period = month(date); if (!period) throw new Error('লেনদেনের তারিখ সঠিক নয়'); const row = await connection('accounting_periods').where({ period_month: period, status: 'closed' }).first(); if (row) throw new Error(`${period.slice(0, 7)} হিসাব মাস বন্ধ করা হয়েছে; এই তারিখে লেনদেন পরিবর্তন করা যাবে না।`); }

async function readiness(value) {
  const period = month(value); if (!period) throw new Error('Invalid period'); const next = nextMonth(period);
  const [state, collections, expenses, reconciliations, pendingDonations, drafts, activeBanks, budget, bankRows] = await Promise.all([
    db('accounting_periods').where({ period_month: period }).first(),
    db('collections').where({ status: 'posted' }).where('date', '>=', period).where('date', '<', next).sum('amount as total').count('* as count').first(),
    db('expenses').where({ status: 'posted' }).where('date', '>=', period).where('date', '<', next).sum('amount as total').count('* as count').first(),
    db('bank_reconciliations').where('statement_date', '>=', period).where('statement_date', '<', next).countDistinct('bank_id as count').first(),
    db('online_donation_submissions').where({ status: 'pending' }).where('created_at', '>=', period).where('created_at', '<', next).count('* as count').first(),
    db('communications').where({ status: 'draft' }).where('created_at', '>=', period).where('created_at', '<', next).count('* as count').first(),
    db('banks').where({ is_active: true }).count('* as count').first(),
    db('management_targets').where({ target_month: period }).first(),
    db('bank_reconciliations as r').join('banks as b', 'r.bank_id', 'b.id').where('r.statement_date', '>=', period).where('r.statement_date', '<', next).select('b.name', 'r.statement_date', 'r.system_balance', 'r.statement_balance', 'r.difference'),
  ]);
  const checks = { activeBanks: Number(activeBanks.count || 0), reconciledBanks: Number(reconciliations.count || 0), pendingDonations: Number(pendingDonations.count || 0), draftCommunications: Number(drafts.count || 0) };
  checks.issueCount = Math.max(0, checks.activeBanks - checks.reconciledBanks) + checks.pendingDonations + checks.draftCommunications;
  return { month: period.slice(0, 7), state: state || { status: 'open' }, collections: { count: Number(collections.count || 0), total: Number(collections.total || 0) }, expenses: { count: Number(expenses.count || 0), total: Number(expenses.total || 0) }, checks, budget: { collectionTarget: Number((budget || {}).collection_target || 0), expenseBudget: Number((budget || {}).expense_budget || 0) }, reconciliations: bankRows.map(row => ({ ...row, system_balance: Number(row.system_balance), statement_balance: Number(row.statement_balance), difference: Number(row.difference) })) };
}

async function reference(trx, prefix) { const result = await trx.raw("SELECT nextval('accounting_close_reference_seq') value"); return `${prefix}-${new Date().getFullYear()}-${String(result.rows[0].value).padStart(6, '0')}`; }
async function close(value, data, userId) {
  const report = await readiness(value); if (report.state.status === 'closed') throw new Error('এই হিসাব মাস ইতোমধ্যে বন্ধ।');
  if (report.checks.issueCount && !String(data.override_reason || '').trim()) throw new Error('অসম্পন্ন যাচাই থাকলে ওভাররাইডের কারণ লিখুন।');
  const snapshot = { version: 1, capturedAt: new Date().toISOString(), period: report.month, collections: report.collections, expenses: report.expenses, netBalance: report.collections.total - report.expenses.total, budget: report.budget, checks: report.checks, reconciliations: report.reconciliations };
  return db.transaction(async trx => {
    const values = { period_month: `${report.month}-01`, status: 'closed', closing_notes: data.notes || null, closed_by: userId, closed_at: trx.fn.now(), updated_at: trx.fn.now() };
    const [period] = await trx('accounting_periods').insert(values).onConflict('period_month').merge(values).returning('*');
    const [event] = await trx('accounting_period_events').insert({ accounting_period_id: period.id, reference_no: await reference(trx, 'CLOSE'), event_type: 'close', snapshot, checksum: checksum(snapshot), notes: data.notes || null, override_reason: data.override_reason || null, acted_by: userId }).returning('*');
    return event;
  });
}
async function reopen(value, reason, userId) { const periodMonth = month(value); if (!periodMonth || !reason) throw new Error('পুনরায় খোলার কারণ লিখুন'); return db.transaction(async trx => { const period = await trx('accounting_periods').where({ period_month: periodMonth, status: 'closed' }).first(); if (!period) throw new Error('বন্ধ হিসাব মাস পাওয়া যায়নি'); await trx('accounting_periods').where({ id: period.id }).update({ status: 'open', reopened_by: userId, reopened_at: trx.fn.now(), reopen_reason: reason, updated_at: trx.fn.now() }); await trx('accounting_period_events').insert({ accounting_period_id: period.id, reference_no: await reference(trx, 'REOPEN'), event_type: 'reopen', notes: reason, acted_by: userId }); }); }
async function history(limit = 24) { return db('accounting_period_events as e').join('accounting_periods as p', 'e.accounting_period_id', 'p.id').leftJoin('users as u', 'e.acted_by', 'u.id').select('e.*', 'p.period_month', 'u.name as actor_name').orderBy('e.created_at', 'desc').limit(limit); }
async function auditEvent(id) { const event = await db('accounting_period_events as e').join('accounting_periods as p', 'e.accounting_period_id', 'p.id').leftJoin('users as u', 'e.acted_by', 'u.id').select('e.*', 'p.period_month', 'u.name as actor_name').where('e.id', id).first(); if (!event) return null; event.integrityValid = event.snapshot ? checksum(event.snapshot) === event.checksum : true; return event; }
module.exports = { assertOpen, readiness, close, reopen, history, auditEvent };
