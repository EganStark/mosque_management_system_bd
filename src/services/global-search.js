const db = require('../config/db');
const security = require('./security');
function term(value) { return String(value || '').trim().replace(/[%_]/g, '').slice(0, 100); }
function result(type, icon, title, subtitle, href, meta) { return { type, icon, title, subtitle, href, meta }; }
async function search(value, role) {
  const q = term(value); if (q.length < 2) return { query: q, groups: [], total: 0 }; const like = `%${q}%`;
  const keys = ['members.manage', 'finance.manage', 'people.manage', 'assets.manage'];
  const allowed = Object.fromEntries(await Promise.all(keys.map(async key => [key, await security.allowed(role, key)]))); const tasks = [];
  if (allowed['members.manage']) tasks.push(db('members').where(b => b.whereILike('name', like).orWhereILike('id_no', like).orWhereILike('phone', like)).select('id', 'id_no', 'name', 'phone').limit(8).then(rows => rows.map(r => result('সদস্য', 'person', r.name, `${r.id_no}${r.phone ? ` · ${r.phone}` : ''}`, `/members/${r.id}`))));
  if (allowed['finance.manage']) {
    tasks.push(db('collections').where(b => b.whereILike('receipt_no', like).orWhereILike('payer_name', like).orWhereILike('purpose', like).orWhereILike('transaction_reference', like)).select('id', 'receipt_no', 'payer_name', 'purpose', 'amount').limit(8).then(rows => rows.map(r => result('আদায়', 'receipt_long', r.receipt_no || `#${r.id}`, r.payer_name || r.purpose, `/collections/${r.id}/receipt`, `৳ ${Number(r.amount).toFixed(2)}`))));
    tasks.push(db('expenses').where(b => b.whereILike('voucher_no', like).orWhereILike('payee', like).orWhereILike('purpose', like).orWhereILike('transaction_reference', like)).select('id', 'voucher_no', 'payee', 'purpose', 'amount').limit(8).then(rows => rows.map(r => result('খরচ', 'request_quote', r.voucher_no || `#${r.id}`, r.payee || r.purpose, `/expenses/${r.id}/voucher`, `৳ ${Number(r.amount).toFixed(2)}`))));
    tasks.push(db('mosque_loans').where(b => b.whereILike('loan_no', like).orWhereILike('borrower_name', like).orWhereILike('phone', like)).select('id', 'loan_no', 'borrower_name', 'principal_amount', 'repaid_amount').limit(8).then(rows => rows.map(r => result('ঋণ', 'account_balance_wallet', r.loan_no, r.borrower_name, `/loans/${r.id}`, `বকেয়া ৳ ${(Number(r.principal_amount) - Number(r.repaid_amount)).toFixed(2)}`))));
    tasks.push(db('donation_pledges').where(b => b.whereILike('pledge_no', like).orWhereILike('donor_name', like).orWhereILike('phone', like).orWhereILike('purpose', like)).select('id', 'pledge_no', 'donor_name', 'pledged_amount', 'paid_amount').limit(8).then(rows => rows.map(r => result('অঙ্গীকার', 'handshake', r.pledge_no, r.donor_name, `/pledges/${r.id}`, `বকেয়া ৳ ${(Number(r.pledged_amount) - Number(r.paid_amount)).toFixed(2)}`))));
  }
  if (allowed['people.manage']) {
    tasks.push(db('document_records').where(b => b.whereILike('reference_no', like).orWhereILike('title', like).orWhereILike('recipient_name', like).orWhereILike('subject', like)).select('id', 'reference_no', 'title', 'status').limit(8).then(rows => rows.map(r => result('নথি', 'description', r.reference_no, r.title, `/documents/${r.id}`, r.status))));
    tasks.push(db('committee_meetings').where(b => b.whereILike('meeting_no', like).orWhereILike('title', like).orWhereILike('venue', like)).select('id', 'meeting_no', 'title', 'meeting_date').limit(8).then(rows => rows.map(r => result('সভা', 'groups', r.meeting_no, r.title, `/governance-meetings/${r.id}`, String(r.meeting_date).slice(0, 10)))));
    tasks.push(db('mosque_tasks').where(b => b.whereILike('task_no', like).orWhereILike('title', like).orWhereILike('description', like)).select('id', 'task_no', 'title', 'status', 'priority').limit(8).then(rows => rows.map(r => result('কাজ', 'task_alt', r.task_no, r.title, `/tasks/${r.id}`, `${r.priority} · ${r.status}`))));
  }
  if (allowed['assets.manage']) {
    tasks.push(db('assets').where(b => b.whereILike('asset_code', like).orWhereILike('name', like).orWhereILike('location', like)).select('id', 'asset_code', 'name', 'location', 'status').limit(8).then(rows => rows.map(r => result('সম্পদ', 'inventory_2', r.asset_code, r.name, `/assets/${r.id}`, r.location || r.status))));
    tasks.push(db('maintenance_work_orders').where(b => b.whereILike('work_order_no', like).orWhereILike('title', like).orWhereILike('description', like)).select('id', 'work_order_no', 'title', 'status', 'priority').limit(8).then(rows => rows.map(r => result('রক্ষণাবেক্ষণ', 'build', r.work_order_no, r.title, `/maintenance/${r.id}`, `${r.priority} · ${r.status}`))));
  }
  const rows = (await Promise.all(tasks)).flat(); const groups = [...new Set(rows.map(row => row.type))].map(type => ({ type, items: rows.filter(row => row.type === type) })); return { query: q, groups, total: rows.length };
}
module.exports = { search };
