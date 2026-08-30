// Aggregated/combined queries for reports and the dashboard.
const db = require('../config/db');
const collections = require('./collections');
const expenses = require('./expenses');

/**
 * Loss & Profit: union of collections (income) and expenses, ordered by date.
 * Returns { rows, prevBalance, subtotalIncome, subtotalExpense, total }.
 */
async function lossAndProfit({ from, to } = {}) {
  const rows = await collections.list({ from, to, status: 'posted' }).then((cs) =>
    cs.map((c) => ({
      date: c.date,
      member: c.member_name || '',
      type: 'আদায়',
      purpose: c.purpose || '',
      income: Number(c.amount || 0),
      expense: 0,
    }))
  );
  const exp = await expenses.list({ from, to, status: 'posted' }).then((es) =>
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
function localDateString(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
async function dashboard(month) {
  const match = String(month || '').match(/^(\d{4})-(\d{2})$/);
  const requestedMonth = match && Number(match[2]) >= 1 && Number(match[2]) <= 12 ? new Date(Number(match[1]), Number(match[2]) - 1, 1) : null;
  const now = requestedMonth || new Date();
  const monthStart = localDateString(new Date(now.getFullYear(), now.getMonth(), 1));
  const monthEnd = localDateString(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  const previousDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const previousStart = localDateString(previousDate);
  const previousEnd = localDateString(new Date(now.getFullYear(), now.getMonth(), 0));

  const collectionMethodQuery = db('collections').where('status', 'posted').select(db.raw("COALESCE(payment_method, 'cash') as payment_method")).sum('amount as total').groupByRaw("COALESCE(payment_method, 'cash')");
  const expenseMethodQuery = db('expenses').where('status', 'posted').select(db.raw("COALESCE(payment_method, 'cash') as payment_method")).sum('amount as total').groupByRaw("COALESCE(payment_method, 'cash')");
  const [monthCollection, monthExpense, previousCollection, previousExpense, totalCollection, totalExpense, collectionByMethod, expenseByMethod, recentCollectionsAll, recentExpensesAll] = await Promise.all([
    collections.total({ from: monthStart, to: monthEnd }), expenses.total({ from: monthStart, to: monthEnd }),
    collections.total({ from: previousStart, to: previousEnd }), expenses.total({ from: previousStart, to: previousEnd }),
    collections.total(), expenses.total(), collectionMethodQuery, expenseMethodQuery, collections.list(), expenses.list(),
  ]);
  const methodTotal = (rows, method) => Number((rows.find((r) => r.payment_method === method) || {}).total || 0);
  const cashBalance = methodTotal(collectionByMethod, 'cash') - methodTotal(expenseByMethod, 'cash');
  const bankRecordedBalance = methodTotal(collectionByMethod, 'bank') - methodTotal(expenseByMethod, 'bank');
  const mobileBankingBalance = methodTotal(collectionByMethod, 'mobile_banking') - methodTotal(expenseByMethod, 'mobile_banking');

  const recentCollections = recentCollectionsAll.slice(0, 4);
  const recentExpenses = recentExpensesAll.slice(0, 4);
  const recentActivity = [
    ...recentCollections.map((row) => ({ ...row, activityType: 'collection' })),
    ...recentExpenses.map((row) => ({ ...row, activityType: 'expense' })),
  ].sort((a, b) => new Date(b.created_at || b.date) - new Date(a.created_at || a.date)).slice(0, 6);

  // Fetch collections vs expenses for the last 6 months dynamically
  const chartMonths = [];
  const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const monthNamesBn = ['জানু', 'ফেব্রু', 'মার্চ', 'এপ্রি', 'মে', 'জুন', 'জুলা', 'আগ', 'সেপ্টে', 'অক্টো', 'নভে', 'ডিসে'];

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const start = localDateString(new Date(d.getFullYear(), d.getMonth(), 1));
    const end = localDateString(new Date(d.getFullYear(), d.getMonth() + 1, 0));
    chartMonths.push({ d, start, end });
  }
  const chartData = await Promise.all(chartMonths.map(async ({ d, start, end }) => { const [col, exp] = await Promise.all([collections.total({ from: start, to: end }), expenses.total({ from: start, to: end })]); return { label: monthNamesBn[d.getMonth()], labelEn: monthNames[d.getMonth()], collections: col, expenses: exp }; }));
  const percentChange = (current, previous) => previous ? Math.round(((current - previous) / previous) * 100) : null;
  const previousBalance = previousCollection - previousExpense;
  const previousMonthValue = `${previousDate.getFullYear()}-${String(previousDate.getMonth() + 1).padStart(2, '0')}`;
  const nextDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  return {
    month: now,
    monthValue: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
    monthCollection,
    monthExpense,
    monthBalance: monthCollection - monthExpense,
    previousMonthValue,
    nextMonthValue: `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`,
    comparison: { previousCollection, previousExpense, previousBalance, collectionPercent: percentChange(monthCollection, previousCollection), expensePercent: percentChange(monthExpense, previousExpense), balancePercent: percentChange(monthCollection - monthExpense, previousBalance) },
    totalCollection,
    totalExpense,
    totalBalance: totalCollection - totalExpense,
    cashBalance,
    bankRecordedBalance,
    mobileBankingBalance,
    recentActivity,
    chartData
  };
}

async function memberLedger({ member_id, from, to } = {}) {
  const memberQ = db('members').select('id', 'id_no', 'name', 'phone', 'monthly_payment', 'monthly_payment_amount').orderBy('id_no');
  if (member_id) memberQ.where('id', member_id);
  const collectionQ = db('collections').where({ status: 'posted' }).select('member_id').sum('amount as total').groupBy('member_id');
  const billQ = db('monthly_bills').select('member_id').sum('amount_due as billed').sum('amount_paid as paid').groupBy('member_id');
  if (member_id) { collectionQ.where('member_id', member_id); billQ.where('member_id', member_id); }
  if (from) { collectionQ.where('date', '>=', from); billQ.where('billing_month', '>=', from); }
  if (to) { collectionQ.where('date', '<=', to); billQ.where('billing_month', '<=', to); }
  const [members, collectionsByMember, billsByMember] = await Promise.all([memberQ, collectionQ, billQ]);
  const collectionMap = new Map(collectionsByMember.map((r) => [Number(r.member_id), Number(r.total || 0)]));
  const billMap = new Map(billsByMember.map((r) => [Number(r.member_id), r]));
  return members.map((row) => { const bill = billMap.get(Number(row.id)) || {}; const billed = Number(bill.billed || 0), paid = Number(bill.paid || 0); return { ...row, total_collections: collectionMap.get(Number(row.id)) || 0, total_billed: billed, monthly_paid: paid, outstanding: billed - paid }; });
}

async function monthlyDues({ month, status } = {}) {
  const q = db('monthly_bills as mb').join('members as m', 'mb.member_id', 'm.id')
    .select('mb.*', 'm.id_no', 'm.name', 'm.phone').orderBy('m.id_no');
  if (month) q.where('mb.billing_month', `${month}-01`);
  if (status === 'paid') q.where('mb.status', 'paid');
  if (status === 'due') q.whereIn('mb.status', ['unpaid', 'partial']);
  const rows = await q;
  const totals = rows.reduce((a, r) => ({ billed: a.billed + Number(r.amount_due), paid: a.paid + Number(r.amount_paid), outstanding: a.outstanding + Number(r.amount_due) - Number(r.amount_paid) }), { billed: 0, paid: 0, outstanding: 0 });
  return { rows, totals };
}

async function categorySummary({ from, to } = {}) {
  const incomeQ = db('collections as c').leftJoin('collection_categories as cc', 'c.collection_category_id', 'cc.id').where('c.status', 'posted')
    .select(db.raw("COALESCE(cc.name, c.account, 'অন্যান্য') as category")).count('c.id as count').sum('c.amount as total').groupByRaw("COALESCE(cc.name, c.account, 'অন্যান্য')").orderBy('total', 'desc');
  const expenseQ = db('expenses as e').leftJoin('expense_heads as eh', 'e.expense_head_id', 'eh.id').where('e.status', 'posted')
    .select(db.raw("COALESCE(eh.name, 'অন্যান্য') as category")).count('e.id as count').sum('e.amount as total').groupByRaw("COALESCE(eh.name, 'অন্যান্য')").orderBy('total', 'desc');
  [incomeQ, expenseQ].forEach((q) => { if (from) q.where('date', '>=', from); if (to) q.where('date', '<=', to); });
  const [income, expense] = await Promise.all([incomeQ, expenseQ]);
  return { income, expense, totalIncome: income.reduce((s, r) => s + Number(r.total), 0), totalExpense: expense.reduce((s, r) => s + Number(r.total), 0) };
}

async function receiptBookUsage() {
  const rows = await db('book_numbers as bn').leftJoin('book_types as bt', 'bn.book_type_id', 'bt.id')
    .leftJoin(db('collections').where({ status: 'posted' }).as('c'), 'bn.id', 'c.book_number_id')
    .select('bn.*', 'bt.name as book_type_name').count('c.id as used_count').sum('c.amount as collected_total').groupBy('bn.id', 'bt.name').orderBy('bn.id', 'desc');
  return rows.map((r) => ({ ...r, used_count: Number(r.used_count || 0), collected_total: Number(r.collected_total || 0) }));
}

async function communityMembers(filters = {}) {
  const children = db('member_children').select('member_id').count('* as child_count').groupBy('member_id').as('ch');
  const referred = db('members').whereNotNull('reference_member_id').select('reference_member_id').count('* as referred_count').groupBy('reference_member_id').as('rf');
  const q = db('members as m').leftJoin('occupations as o', 'm.occupation_id', 'o.id')
    .leftJoin('divisions as dv', 'm.division_id', 'dv.id').leftJoin('districts as ds', 'm.district_id', 'ds.id')
    .leftJoin('thanas as th', 'm.thana_id', 'th.id').leftJoin('post_offices as po', 'm.post_office_id', 'po.id')
    .leftJoin('villages as vl', 'm.village_id', 'vl.id').leftJoin('areas as ar', 'm.area_id', 'ar.id')
    .leftJoin('members as ref', 'm.reference_member_id', 'ref.id').leftJoin(children, 'm.id', 'ch.member_id').leftJoin(referred, 'm.id', 'rf.reference_member_id')
    .select('m.id','m.id_no','m.name','m.phone','m.gender','m.status','m.birth_date','m.monthly_payment','m.monthly_payment_amount','m.address_text','m.occupation_section',
      'o.name as occupation','dv.name as division','ds.name as district','th.name as thana','po.name as post_office','vl.name as village','ar.name as area',
      'ref.id_no as reference_no','ref.name as reference_name',db.raw('COALESCE(ch.child_count,0)::int as child_count'),db.raw('COALESCE(rf.referred_count,0)::int as referred_count'))
    .orderBy('m.id_no');
  if (filters.status && ['active','deactive'].includes(filters.status)) q.where('m.status', filters.status);
  if (filters.gender && ['male','female'].includes(filters.gender)) q.where('m.gender', filters.gender);
  if (filters.occupation_id) q.where('m.occupation_id', filters.occupation_id);
  if (filters.area_id) q.where('m.area_id', filters.area_id);
  if (filters.village_id) q.where('m.village_id', filters.village_id);
  if (filters.monthly === 'yes') q.where('m.monthly_payment', true);
  if (filters.monthly === 'no') q.where(qb => qb.where('m.monthly_payment', false).orWhereNull('m.monthly_payment'));
  const rows = await q;
  const groupKey = filters.group === 'occupation' ? 'occupation' : filters.group === 'location' ? 'area' : filters.group === 'reference' ? 'reference_name' : null;
  const groups = groupKey ? Object.values(rows.reduce((acc,row)=>{const name=row[groupKey]||'অনির্ধারিত';if(!acc[name])acc[name]={name,count:0,male:0,female:0,monthly:0,amount:0};const g=acc[name];g.count++;g[row.gender]=(g[row.gender]||0)+1;if(row.monthly_payment){g.monthly++;g.amount+=Number(row.monthly_payment_amount||0);}return acc;},{})).sort((a,b)=>b.count-a.count) : [];
  const summary = { total: rows.length, active: rows.filter(r=>r.status==='active').length, male: rows.filter(r=>r.gender==='male').length, female: rows.filter(r=>r.gender==='female').length, monthly: rows.filter(r=>r.monthly_payment).length, monthlyAmount: rows.reduce((s,r)=>s+(r.monthly_payment?Number(r.monthly_payment_amount||0):0),0), referenced: rows.filter(r=>r.reference_name).length };
  return { rows, groups, summary };
}

async function communityOptions(){const [occupations,areas,villages]=await Promise.all([db('occupations').orderBy('name'),db('areas').orderBy('name'),db('villages').orderBy('name')]);return{occupations,areas,villages};}

module.exports = { lossAndProfit, bankStatement, dashboard, memberLedger, monthlyDues, categorySummary, receiptBookUsage, communityMembers, communityOptions };
