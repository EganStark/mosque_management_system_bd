// Aggregated/combined queries for reports and the dashboard.
const db = require('../config/db');
const collections = require('./collections');
const expenses = require('./expenses');

/**
 * Loss & Profit: union of collections (income) and expenses, ordered by date.
 * Returns { rows, prevBalance, subtotalIncome, subtotalExpense, total }.
 */
async function lossAndProfit({ from, to } = {}) {
  const rows = await collections.list({ from, to }).then((cs) =>
    cs.map((c) => ({
      date: c.date,
      member: c.member_name || '',
      type: 'আদায়',
      purpose: c.purpose || '',
      income: Number(c.amount || 0),
      expense: 0,
    }))
  );
  const exp = await expenses.list({ from, to }).then((es) =>
    es.map((e) => ({
      date: e.date,
      member: '',
      type: 'খরচ',
      purpose: e.purpose || e.head_name || '',
      income: 0,
      expense: Number(e.amount || 0),
    }))
  );
  const merged = [...rows, ...exp].sort((a, b) => new Date(a.date) - new Date(b.date));

  // Previous balance = all activity strictly before `from`.
  let prevBalance = 0;
  if (from) {
    const prevIncome = await collections.total({ to: dayBefore(from) });
    const prevExpense = await expenses.total({ to: dayBefore(from) });
    prevBalance = prevIncome - prevExpense;
  }
  const subtotalIncome = merged.reduce((s, r) => s + r.income, 0);
  const subtotalExpense = merged.reduce((s, r) => s + r.expense, 0);
  return {
    rows: merged,
    prevBalance,
    subtotalIncome,
    subtotalExpense,
    total: prevBalance + subtotalIncome - subtotalExpense,
  };
}

/** Bank statement with running balance and previous balance. */
async function bankStatement({ from, to, bank_id } = {}) {
  const banks = require('./banks');
  const list = await banks.transactions.list({ from, to, bank_id });
  const ordered = list.sort((a, b) => new Date(a.date) - new Date(b.date));
  let prevBalance = 0;
  if (from) prevBalance = await banks.balance({ upto: dayBefore(from) });
  let running = prevBalance;
  const rows = ordered.map((t) => {
    const deposit = t.type === 'deposit' ? Number(t.amount || 0) : 0;
    const withdraw = t.type === 'withdraw' ? Number(t.amount || 0) : 0;
    running += deposit - withdraw;
    return { ...t, deposit, withdraw, balance: running };
  });
  const subDeposit = rows.reduce((s, r) => s + r.deposit, 0);
  const subWithdraw = rows.reduce((s, r) => s + r.withdraw, 0);
  return { rows, prevBalance, subDeposit, subWithdraw, total: running };
}

function dayBefore(dateStr) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Dashboard figures. */
async function dashboard() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

  const monthCollection = await collections.total({ from: monthStart, to: monthEnd });
  const monthExpense = await expenses.total({ from: monthStart, to: monthEnd });
  const totalCollection = await collections.total();
  const totalExpense = await expenses.total();

  return {
    month: now,
    monthCollection,
    monthExpense,
    monthBalance: monthCollection - monthExpense,
    totalCollection,
    totalExpense,
    totalBalance: totalCollection - totalExpense,
  };
}

module.exports = { lossAndProfit, bankStatement, dashboard };
