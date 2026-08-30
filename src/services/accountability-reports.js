const db = require('../config/db');
const treasury = require('./treasury');

async function annual({ year }) {
  const from = `${year}-01-01`, to = `${year}-12-31`;
  const [incomeRows, expenseRows, banks, loans] = await Promise.all([
    db('collections').where({ status: 'posted' }).whereBetween('date', [from, to]).select(db.raw('EXTRACT(MONTH FROM date)::int AS "month"')).sum('amount as total').groupByRaw('EXTRACT(MONTH FROM date)'),
    db('expenses').where({ status: 'posted' }).whereBetween('date', [from, to]).select(db.raw('EXTRACT(MONTH FROM date)::int AS "month"')).sum('amount as total').groupByRaw('EXTRACT(MONTH FROM date)'),
    db('banks').where({ is_active: true }).orderBy('name'),
    db('mosque_loans').whereNot({ status: 'cancelled' }).where('issue_date', '<=', to).select(db.raw('COALESCE(SUM(principal_amount-repaid_amount),0) AS total')).first(),
  ]);
  const income = new Map(incomeRows.map(r => [Number(r.month), Number(r.total)])), expense = new Map(expenseRows.map(r => [Number(r.month), Number(r.total)]));
  const rows = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, income: income.get(i + 1) || 0, expense: expense.get(i + 1) || 0, balance: (income.get(i + 1) || 0) - (expense.get(i + 1) || 0) }));
  const accounts = await Promise.all(banks.map(async b => ({ name: b.name, balance: await treasury.bankBalance(b.id, to) })));
  const summary = { income: rows.reduce((s,r)=>s+r.income,0), expense: rows.reduce((s,r)=>s+r.expense,0), operating: rows.reduce((s,r)=>s+r.balance,0), cash: await treasury.cashBalance(to), bank: accounts.reduce((s,r)=>s+r.balance,0), receivable: Number(loans.total || 0) };
  summary.liquid = summary.cash + summary.bank; summary.resources = summary.liquid + summary.receivable;
  return { rows, accounts, summary };
}

async function loanReceivables({ status }) {
  const q = db('mosque_loans as l').leftJoin('members as m','l.member_id','m.id').select('l.*','m.id_no as member_no').whereNot('l.status','cancelled').orderBy('l.final_due_date','asc').orderBy('l.issue_date','desc');
  if (status === 'open') q.whereIn('l.status',['active','overdue']); else if (['active','overdue','paid'].includes(status)) q.where('l.status',status);
  const rows = await q; return { rows, summary: { count: rows.length, issued: rows.reduce((s,r)=>s+Number(r.principal_amount),0), repaid: rows.reduce((s,r)=>s+Number(r.repaid_amount),0), outstanding: rows.reduce((s,r)=>s+Number(r.principal_amount)-Number(r.repaid_amount),0), overdue: rows.filter(r=>r.status==='overdue').reduce((s,r)=>s+Number(r.principal_amount)-Number(r.repaid_amount),0) } };
}

async function pledgeDues({ status }) {
  const q = db('donation_pledges as p').leftJoin('members as m','p.member_id','m.id').leftJoin('collection_categories as c','p.collection_category_id','c.id').select('p.*','m.id_no as member_no','c.name as category_name').whereNot('p.status','cancelled').orderBy('p.due_date','asc').orderBy('p.pledge_date','desc');
  if (status === 'open') q.whereIn('p.status',['active','partial','overdue']); else if (['active','partial','overdue','paid'].includes(status)) q.where('p.status',status);
  const rows=await q;return{rows,summary:{count:rows.length,pledged:rows.reduce((s,r)=>s+Number(r.pledged_amount),0),paid:rows.reduce((s,r)=>s+Number(r.paid_amount),0),due:rows.reduce((s,r)=>s+Number(r.pledged_amount)-Number(r.paid_amount),0),overdue:rows.filter(r=>r.status==='overdue').reduce((s,r)=>s+Number(r.pledged_amount)-Number(r.paid_amount),0)}};
}

async function welfareFunds({ fund, year }) {
  const q=db('welfare_applications as a').join('welfare_beneficiaries as b','a.beneficiary_id','b.id').select('a.*','b.name as beneficiary_name','b.phone').whereRaw('EXTRACT(YEAR FROM a.created_at)=?', [year]).orderBy('a.created_at','desc'); if(fund&&['zakat','sadaqah','general','emergency'].includes(fund))q.where('a.fund_source',fund);const rows=await q;return{rows,summary:{count:rows.length,requested:rows.reduce((s,r)=>s+Number(r.requested_amount),0),approved:rows.reduce((s,r)=>s+Number(r.approved_amount),0),disbursed:rows.reduce((s,r)=>s+Number(r.disbursed_amount),0),pending:rows.filter(r=>r.status==='pending').length}};
}

async function generate(type, filters){if(type==='annual')return annual(filters);if(type==='loans')return loanReceivables(filters);if(type==='pledges')return pledgeDues(filters);if(type==='welfare')return welfareFunds(filters);throw new Error('Invalid accountability report');}
module.exports={generate,types:['annual','loans','pledges','welfare']};
