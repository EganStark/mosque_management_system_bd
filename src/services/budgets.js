const db = require('../config/db');
const executiveDashboard = require('./executive-dashboard');

async function targetFor(month, create = false, userId = null) {
  const targetMonth = executiveDashboard.monthValue(month);
  if (!targetMonth) throw new Error('Invalid budget month');
  let target = await db('management_targets').where({ target_month: targetMonth }).first();
  if (!target && create) [target] = await db('management_targets').insert({ target_month: targetMonth, updated_by: userId }).returning('*');
  return { targetMonth, target };
}

async function planner(month) {
  const { targetMonth, target } = await targetFor(month);
  const [year, monthNo] = targetMonth.split('-').map(Number);
  const nextMonth = monthNo === 12 ? `${year + 1}-01-01` : `${year}-${String(monthNo + 1).padStart(2, '0')}-01`;
  const [categories, heads, lines, incomeActual, expenseActual] = await Promise.all([
    db('collection_categories').where({ is_active: true }).orderBy('name'),
    db('expense_heads').orderBy('name'),
    target ? db('budget_lines').where({ management_target_id: target.id }) : [],
    db('collections').where({ status: 'posted' }).where('date', '>=', targetMonth).where('date', '<', nextMonth).select('collection_category_id').sum('amount as actual').groupBy('collection_category_id'),
    db('expenses').where({ status: 'posted' }).where('date', '>=', targetMonth).where('date', '<', nextMonth).select('expense_head_id').sum('amount as actual').groupBy('expense_head_id'),
  ]);
  const lineMap = new Map(lines.map(line => [`${line.line_type}:${line.collection_category_id || line.expense_head_id}`, line]));
  const incomeMap = new Map(incomeActual.map(row => [Number(row.collection_category_id), Number(row.actual || 0)]));
  const expenseMap = new Map(expenseActual.map(row => [Number(row.expense_head_id), Number(row.actual || 0)]));
  const income = categories.map(item => { const line = lineMap.get(`income:${item.id}`); const budget = Number((line || {}).budget_amount || 0), actual = incomeMap.get(item.id) || 0; return { ...item, lineId: line && line.id, budget, actual, variance: actual - budget, notes: (line || {}).notes || '' }; });
  const expense = heads.map(item => { const line = lineMap.get(`expense:${item.id}`); const budget = Number((line || {}).budget_amount || 0), actual = expenseMap.get(item.id) || 0; return { ...item, lineId: line && line.id, budget, actual, variance: budget - actual, notes: (line || {}).notes || '' }; });
  const total = rows => rows.reduce((sum, row) => sum + row.budget, 0);
  const actualTotal = rows => rows.reduce((sum, row) => sum + row.actual, 0);
  return { month: targetMonth.slice(0, 7), income, expense, summary: { incomeBudget: total(income), incomeActual: actualTotal(income), expenseBudget: total(expense), expenseActual: actualTotal(expense) } };
}

async function saveLine(data, userId) {
  const { target } = await targetFor(data.month, true, userId);
  const type = data.line_type;
  const referenceId = Number(data.reference_id);
  const values = { management_target_id: target.id, line_type: type, collection_category_id: type === 'income' ? referenceId : null, expense_head_id: type === 'expense' ? referenceId : null, budget_amount: Number(data.budget_amount), notes: data.notes || null, updated_by: userId, updated_at: db.fn.now() };
  const lookup = type === 'income' ? { management_target_id: target.id, line_type: type, collection_category_id: referenceId } : { management_target_id: target.id, line_type: type, expense_head_id: referenceId };
  const existing = await db('budget_lines').where(lookup).first();
  if (existing) await db('budget_lines').where({ id: existing.id }).update(values);
  else await db('budget_lines').insert(values);
  await syncTotals(target.id);
}

async function syncTotals(targetId) {
  const rows = await db('budget_lines').where({ management_target_id: targetId }).select('line_type').sum('budget_amount as total').groupBy('line_type');
  const amount = type => Number((rows.find(row => row.line_type === type) || {}).total || 0);
  await db('management_targets').where({ id: targetId }).update({ collection_target: amount('income'), expense_budget: amount('expense'), updated_at: db.fn.now() });
}

module.exports = { planner, saveLine };
