const db = require('../config/db');

function monthValue(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})/);
  if (!match || Number(match[2]) < 1 || Number(match[2]) > 12) return null;
  return `${match[1]}-${match[2]}-01`;
}

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

async function get(month) {
  const targetMonth = monthValue(month) || currentMonth();
  const [year, monthNumber] = targetMonth.split('-').map(Number);
  const nextMonth = monthNumber === 12 ? `${year + 1}-01-01` : `${year}-${String(monthNumber + 1).padStart(2, '0')}-01`;
  const previousStart = monthNumber === 1 ? `${year - 1}-12-01` : `${year}-${String(monthNumber - 1).padStart(2, '0')}-01`;
  const [target, actual, previous, dues, pledges, donationTrend] = await Promise.all([
    db('management_targets').where({ target_month: targetMonth }).first(),
    db.raw("SELECT COALESCE((SELECT SUM(amount) FROM collections WHERE status='posted' AND date>=? AND date<?),0) collection, COALESCE((SELECT SUM(amount) FROM expenses WHERE status='posted' AND date>=? AND date<?),0) expense", [targetMonth, nextMonth, targetMonth, nextMonth]),
    db.raw("SELECT COALESCE((SELECT SUM(amount) FROM collections WHERE status='posted' AND date>=? AND date<?),0) collection, COALESCE((SELECT SUM(amount) FROM expenses WHERE status='posted' AND date>=? AND date<?),0) expense", [previousStart, targetMonth, previousStart, targetMonth]),
    db('monthly_bills').where({ billing_month: targetMonth }).whereIn('status', ['unpaid', 'partial']).first(db.raw('COUNT(*)::int records'), db.raw('COALESCE(SUM(amount_due-amount_paid),0) amount')),
    db('donation_pledges').whereIn('status', ['active', 'partial', 'overdue']).first(db.raw('COUNT(*)::int records'), db.raw('COALESCE(SUM(pledged_amount-paid_amount),0) amount'), db.raw("COUNT(*) FILTER (WHERE next_follow_up_date IS NULL OR next_follow_up_date<=CURRENT_DATE)::int follow_ups")),
    db('collections as c').leftJoin('collection_categories as cc', 'c.collection_category_id', 'cc.id').where('c.status', 'posted').where('c.date', '>=', db.raw("?::date - INTERVAL '5 months'", [targetMonth])).where('c.date', '<', nextMonth).where(q => q.whereNot('cc.code', 'monthly').orWhereNull('cc.code')).select(db.raw("to_char(date_trunc('month', c.date), 'YYYY-MM') as period"), db.raw('SUM(c.amount) as amount')).groupByRaw("date_trunc('month', c.date)").orderByRaw("date_trunc('month', c.date)"),
  ]);
  const actualRow = actual.rows[0];
  const previousRow = previous.rows[0];
  const collection = Number(actualRow.collection || 0), expense = Number(actualRow.expense || 0);
  const collectionTarget = Number((target || {}).collection_target || 0), expenseBudget = Number((target || {}).expense_budget || 0);
  return {
    month: targetMonth.slice(0, 7),
    target: { collectionTarget, expenseBudget, notes: (target || {}).notes || '' },
    actual: { collection, expense, balance: collection - expense },
    performance: {
      collectionPercent: collectionTarget > 0 ? Math.round((collection / collectionTarget) * 100) : null,
      collectionGap: collectionTarget - collection,
      expensePercent: expenseBudget > 0 ? Math.round((expense / expenseBudget) * 100) : null,
      budgetRemaining: expenseBudget - expense,
      collectionChange: Number(previousRow.collection || 0) > 0 ? Math.round(((collection - Number(previousRow.collection)) / Number(previousRow.collection)) * 100) : null,
      expenseChange: Number(previousRow.expense || 0) > 0 ? Math.round(((expense - Number(previousRow.expense)) / Number(previousRow.expense)) * 100) : null,
    },
    followUps: { monthlyRecords: Number(dues.records || 0), monthlyAmount: Number(dues.amount || 0), pledgeRecords: Number(pledges.records || 0), pledgeAmount: Number(pledges.amount || 0), pledgeDueToday: Number(pledges.follow_ups || 0) },
    donationTrend: donationTrend.map(row => ({ month: row.period, amount: Number(row.amount || 0) })),
  };
}

async function saveTarget(month, data, userId) {
  const targetMonth = monthValue(month);
  if (!targetMonth) throw new Error('Invalid target month');
  const values = { target_month: targetMonth, collection_target: Number(data.collection_target || 0), expense_budget: Number(data.expense_budget || 0), notes: data.notes || null, updated_by: userId, updated_at: db.fn.now() };
  await db('management_targets').insert(values).onConflict('target_month').merge(values);
}

module.exports = { get, saveTarget, monthValue };
