const db = require('../config/db');

function normalize(rows, config) {
  return rows.map((row) => {
    const requestedAt = row[config.requestedAt] || row.created_at;
    const ageDays = requestedAt ? Math.max(0, Math.floor((Date.now() - new Date(requestedAt).getTime()) / 86400000)) : 0;
    const urgency = config.urgency ? row[config.urgency] : null;
    const slaDays = ['emergency', 'critical', 'urgent'].includes(urgency) ? 1 : urgency === 'high' ? 2 : (config.slaDays || 3);
    return {
    id: row.id,
    reference: row[config.reference] || `#${row.id}`,
    title: row[config.title] || '—',
    detail: config.detail ? row[config.detail] : null,
    amount: config.amount ? Number(row[config.amount] || 0) : null,
    requestedBy: config.requestedBy ? row[config.requestedBy] : null,
    requestedAt,
    urgency,
    ageDays,
    slaDays,
    isOverdue: ageDays >= slaDays,
    href: config.href(row),
    };
  }).sort((a, b) => Number(b.isOverdue) - Number(a.isOverdue) || b.ageDays - a.ageDays);
}

async function get() {
  const [expenseRows, loanRows, welfareRows, releaseRows, procurementRows, paymentRows, maintenanceRows, payrollRows, transferRows, documentRows, donationRows] = await Promise.all([
    db('expenses as e').leftJoin('expense_heads as h', 'e.expense_head_id', 'h.id').leftJoin('users as u', 'e.submitted_by', 'u.id').where('e.status', 'pending').select('e.*', 'h.name as head_name', 'u.name as requester_name').orderBy('e.submitted_at'),
    db('mosque_loans as l').leftJoin('users as u', 'l.submitted_by', 'u.id').where('l.status', 'pending').select('l.*', 'u.name as requester_name').orderBy('l.submitted_at'),
    db('welfare_applications as a').join('welfare_beneficiaries as b', 'a.beneficiary_id', 'b.id').leftJoin('users as u', 'a.created_by', 'u.id').where('a.status', 'pending').select('a.*', 'b.name as beneficiary_name', 'u.name as requester_name').orderByRaw("CASE a.urgency WHEN 'emergency' THEN 0 WHEN 'urgent' THEN 1 ELSE 2 END").orderBy('a.created_at'),
    db('welfare_disbursement_requests as r').join('welfare_applications as a', 'r.application_id', 'a.id').join('welfare_beneficiaries as b', 'a.beneficiary_id', 'b.id').leftJoin('users as u', 'r.requested_by', 'u.id').where('r.status', 'pending').select('r.*', 'a.application_no', 'b.name as beneficiary_name', 'u.name as requester_name').orderBy('r.requested_at'),
    db('purchase_requests as p').leftJoin('users as u', 'p.requested_by', 'u.id').where('p.status', 'submitted').select('p.*', 'u.name as requester_name').orderByRaw("CASE p.priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 ELSE 2 END").orderBy('p.updated_at'),
    db('purchase_payment_requests as r').join('purchase_orders as o', 'r.purchase_order_id', 'o.id').join('purchase_requests as p', 'o.request_id', 'p.id').join('maintenance_vendors as v', 'o.vendor_id', 'v.id').leftJoin('users as u', 'r.requested_by', 'u.id').where('r.status', 'pending').select('r.*', 'o.order_no', 'p.id as request_id', 'v.name as vendor_name', 'u.name as requester_name').orderBy('r.requested_at'),
    db('maintenance_completion_requests as r').join('maintenance_work_orders as w', 'r.work_order_id', 'w.id').leftJoin('users as u', 'r.requested_by', 'u.id').where('r.status', 'pending').select('r.*', 'w.work_order_no', 'w.title as work_title', 'u.name as requester_name').orderBy('r.requested_at'),
    db('staff_payroll_payment_requests as r').join('staff_payrolls as p', 'r.payroll_id', 'p.id').join('staff_members as s', 'p.staff_id', 's.id').leftJoin('users as u', 'r.requested_by', 'u.id').where('r.status', 'pending').select('r.*', 'p.payroll_month', 's.name_bn as staff_name', 'u.name as requester_name').orderBy('r.requested_at'),
    db('treasury_transfer_requests as r').leftJoin('users as u', 'r.requested_by', 'u.id').where('r.status', 'pending').select('r.*', 'u.name as requester_name').orderBy('r.requested_at'),
    db('document_records as d').leftJoin('users as u', 'd.created_by', 'u.id').where('d.status', 'pending').select('d.*', 'u.name as requester_name').orderBy('d.updated_at'),
    db('online_donation_submissions').where({ status: 'pending' }).orderBy('created_at'),
  ]);

  const groups = [
    { key: 'expenses', label: 'খরচ অনুমোদন', icon: 'payments', items: normalize(expenseRows, { reference: 'voucher_no', title: 'head_name', detail: 'purpose', amount: 'amount', requestedBy: 'requester_name', requestedAt: 'submitted_at', href: () => '/expenses' }) },
    { key: 'loans', label: 'ঋণ আবেদন', icon: 'request_quote', items: normalize(loanRows, { reference: 'loan_no', title: 'borrower_name', detail: 'purpose', amount: 'principal_amount', requestedBy: 'requester_name', requestedAt: 'submitted_at', href: (row) => `/loans/${row.id}` }) },
    { key: 'welfare', label: 'কল্যাণ আবেদন', icon: 'volunteer_activism', items: normalize(welfareRows, { reference: 'application_no', title: 'beneficiary_name', detail: 'reason', amount: 'requested_amount', requestedBy: 'requester_name', requestedAt: 'created_at', urgency: 'urgency', href: (row) => `/welfare/${row.id}` }) },
    { key: 'welfare-releases', label: 'কল্যাণ অর্থ ছাড়', icon: 'price_check', items: normalize(releaseRows, { reference: 'application_no', title: 'beneficiary_name', detail: 'remarks', amount: 'amount', requestedBy: 'requester_name', requestedAt: 'requested_at', slaDays: 1, href: (row) => `/welfare/${row.application_id}` }) },
    { key: 'procurement', label: 'ক্রয় অনুরোধ', icon: 'shopping_cart_checkout', items: normalize(procurementRows, { reference: 'request_no', title: 'title', detail: 'justification', amount: 'estimated_total', requestedBy: 'requester_name', requestedAt: 'updated_at', urgency: 'priority', href: (row) => `/procurement/${row.id}` }) },
    { key: 'documents', label: 'নথি অনুমোদন', icon: 'approval', items: normalize(documentRows, { reference: 'reference_no', title: 'title', detail: 'subject', requestedBy: 'requester_name', requestedAt: 'updated_at', href: (row) => `/documents/${row.id}` }) },
    { key: 'donations', label: 'অনলাইন দান যাচাই', icon: 'verified', items: normalize(donationRows, { reference: 'confirmation_no', title: 'donor_name', detail: 'transaction_id', amount: 'amount', requestedAt: 'created_at', href: () => '/public-inbox?tab=donations' }) },
  ];
  groups.splice(5, 0, { key: 'supplier-payments', label: 'Supplier payment approvals', icon: 'payments', items: normalize(paymentRows, { reference: 'order_no', title: 'vendor_name', detail: 'remarks', amount: 'amount', requestedBy: 'requester_name', requestedAt: 'requested_at', slaDays: 1, href: (row) => `/procurement/${row.request_id}` }) });
  groups.splice(6, 0, { key: 'maintenance-completions', label: 'Maintenance completion approvals', icon: 'build_circle', items: normalize(maintenanceRows, { reference: 'work_order_no', title: 'work_title', detail: 'completion_notes', amount: 'actual_cost', requestedBy: 'requester_name', requestedAt: 'requested_at', slaDays: 1, href: (row) => `/maintenance/${row.work_order_id}` }) });
  groups.splice(7, 0, { key: 'payroll-payments', label: 'Payroll payment approvals', icon: 'payments', items: normalize(payrollRows, { reference: 'payroll_month', title: 'staff_name', detail: 'remarks', amount: 'amount', requestedBy: 'requester_name', requestedAt: 'requested_at', slaDays: 1, href: (row) => `/staff-operations/payroll/${row.payroll_id}` }) });
  groups.splice(8, 0, { key: 'treasury-transfers', label: 'Treasury transfer approvals', icon: 'swap_horiz', items: normalize(transferRows, { reference: 'reference', title: 'type', detail: 'remarks', amount: 'amount', requestedBy: 'requester_name', requestedAt: 'requested_at', slaDays: 1, href: () => '/treasury/transfer' }) });
  const total = groups.reduce((sum, group) => sum + group.items.length, 0);
  const amount = groups.reduce((sum, group) => sum + group.items.reduce((value, item) => value + Number(item.amount || 0), 0), 0);
  const overdue = groups.reduce((sum, group) => sum + group.items.filter((item) => item.isOverdue).length, 0);
  return { groups, total, amount, overdue };
}

async function summary() {
  const specs = [
    ['expenses', 'pending'], ['mosque_loans', 'pending'], ['welfare_applications', 'pending'], ['welfare_disbursement_requests', 'pending'],
    ['purchase_requests', 'submitted'], ['purchase_payment_requests', 'pending'], ['maintenance_completion_requests', 'pending'], ['staff_payroll_payment_requests', 'pending'], ['treasury_transfer_requests', 'pending'], ['document_records', 'pending'], ['online_donation_submissions', 'pending'],
  ];
  const rows = await Promise.all(specs.map(([table, status]) => db(table).where({ status }).count('* as count').first()));
  return { total: rows.reduce((sum, row) => sum + Number(row.count || 0), 0) };
}

function decisionRow(type, label, row, fields) {
  const submittedAt = row[fields.submittedAt] || row.created_at;
  const decidedAt = row[fields.decidedAt];
  const responseHours = submittedAt && decidedAt
    ? Math.max(0, (new Date(decidedAt).getTime() - new Date(submittedAt).getTime()) / 3600000)
    : 0;
  const urgency = fields.urgency ? row[fields.urgency] : null;
  const slaHours = ['emergency', 'critical', 'urgent'].includes(urgency) ? 24 : urgency === 'high' ? 48 : 72;
  return {
    type, typeLabel: label, id: row.id,
    reference: row[fields.reference] || `#${row.id}`,
    title: row[fields.title] || '—',
    decision: fields.decision(row),
    notes: row[fields.notes] || null,
    actorName: row.actor_name || '—',
    submittedAt, decidedAt, responseHours, slaHours,
    withinSla: responseHours <= slaHours,
    href: fields.href(row),
  };
}

async function history(filters = {}) {
  const [expenses, loans, welfare, welfareReleases, procurement, supplierPayments, maintenanceCompletions, payrollPayments, treasuryTransfers, documents, donations] = await Promise.all([
    db('expenses as e').leftJoin('expense_heads as h', 'e.expense_head_id', 'h.id').leftJoin('users as u', db.raw('u.id = COALESCE(e.approved_by,e.rejected_by)')).whereIn('e.status', ['posted', 'rejected']).where((q) => q.whereNotNull('e.approved_at').orWhereNotNull('e.rejected_at')).select('e.*', 'h.name as item_title', 'u.name as actor_name'),
    db('mosque_loans as l').leftJoin('users as u', db.raw('u.id = COALESCE(l.approved_by,l.rejected_by)')).whereIn('l.status', ['active', 'overdue', 'paid', 'rejected']).where((q) => q.whereNotNull('l.approved_at').orWhereNotNull('l.rejected_at')).select('l.*', 'u.name as actor_name'),
    db('welfare_applications as a').join('welfare_beneficiaries as b', 'a.beneficiary_id', 'b.id').leftJoin('users as u', 'a.approved_by', 'u.id').whereIn('a.status', ['approved', 'partial', 'paid', 'rejected']).whereNotNull('a.approved_at').select('a.*', 'b.name as beneficiary_name', 'u.name as actor_name'),
    db('welfare_disbursement_requests as r').join('welfare_applications as a', 'r.application_id', 'a.id').join('welfare_beneficiaries as b', 'a.beneficiary_id', 'b.id').leftJoin('users as u', 'r.decided_by', 'u.id').whereIn('r.status', ['approved', 'rejected', 'cancelled']).whereNotNull('r.decided_at').select('r.*', 'a.application_no', 'b.name as beneficiary_name', 'u.name as actor_name'),
    db('purchase_requests as p').leftJoin('users as u', 'p.approved_by', 'u.id').whereIn('p.status', ['approved', 'rejected', 'ordered']).whereNotNull('p.approved_at').select('p.*', 'u.name as actor_name'),
    db('purchase_payment_requests as r').join('purchase_orders as o', 'r.purchase_order_id', 'o.id').join('purchase_requests as p', 'o.request_id', 'p.id').join('maintenance_vendors as v', 'o.vendor_id', 'v.id').leftJoin('users as u', 'r.decided_by', 'u.id').whereIn('r.status', ['approved', 'rejected', 'cancelled']).whereNotNull('r.decided_at').select('r.*', 'o.order_no', 'p.id as request_id', 'v.name as vendor_name', 'u.name as actor_name'),
    db('maintenance_completion_requests as r').join('maintenance_work_orders as w', 'r.work_order_id', 'w.id').leftJoin('users as u', 'r.decided_by', 'u.id').whereIn('r.status', ['approved', 'rejected']).whereNotNull('r.decided_at').select('r.*', 'w.work_order_no', 'w.title as work_title', 'u.name as actor_name'),
    db('staff_payroll_payment_requests as r').join('staff_payrolls as p', 'r.payroll_id', 'p.id').join('staff_members as s', 'p.staff_id', 's.id').leftJoin('users as u', 'r.decided_by', 'u.id').whereIn('r.status', ['approved', 'rejected', 'cancelled']).whereNotNull('r.decided_at').select('r.*', 'p.payroll_month', 's.name_bn as staff_name', 'u.name as actor_name'),
    db('treasury_transfer_requests as r').leftJoin('users as u', 'r.decided_by', 'u.id').whereIn('r.status', ['approved', 'rejected', 'cancelled']).whereNotNull('r.decided_at').select('r.*', 'u.name as actor_name'),
    db('document_approvals as a').join('document_records as d', 'a.document_id', 'd.id').leftJoin('users as u', 'a.acted_by', 'u.id').whereIn('a.action', ['approve', 'reject']).select('a.id', 'a.document_id', 'a.action', 'a.comments', 'a.acted_at', 'd.reference_no', 'd.title', 'd.created_at', 'u.name as actor_name'),
    db('online_donation_submissions as d').leftJoin('users as u', 'd.reviewed_by', 'u.id').whereIn('d.status', ['verified', 'rejected']).whereNotNull('d.reviewed_at').select('d.*', 'u.name as actor_name'),
  ]);
  let rows = [
    ...expenses.map((row) => decisionRow('expenses', 'খরচ', row, { reference: 'voucher_no', title: 'item_title', submittedAt: 'submitted_at', decidedAt: row.status === 'rejected' ? 'rejected_at' : 'approved_at', notes: 'decision_notes', decision: (x) => x.status === 'rejected' ? 'rejected' : 'approved', href: () => '/expenses' })),
    ...loans.map((row) => decisionRow('loans', 'ঋণ', row, { reference: 'loan_no', title: 'borrower_name', submittedAt: 'submitted_at', decidedAt: row.status === 'rejected' ? 'rejected_at' : 'approved_at', notes: 'decision_notes', decision: (x) => x.status === 'rejected' ? 'rejected' : 'approved', href: (x) => `/loans/${x.id}` })),
    ...welfare.map((row) => decisionRow('welfare', 'কল্যাণ', row, { reference: 'application_no', title: 'beneficiary_name', submittedAt: 'created_at', decidedAt: 'approved_at', notes: 'decision_notes', urgency: 'urgency', decision: (x) => x.status === 'rejected' ? 'rejected' : 'approved', href: (x) => `/welfare/${x.id}` })),
    ...procurement.map((row) => decisionRow('procurement', 'ক্রয়', row, { reference: 'request_no', title: 'title', submittedAt: 'created_at', decidedAt: 'approved_at', notes: 'decision_notes', urgency: 'priority', decision: (x) => x.status === 'rejected' ? 'rejected' : 'approved', href: (x) => `/procurement/${x.id}` })),
    ...documents.map((row) => decisionRow('documents', 'নথি', row, { reference: 'reference_no', title: 'title', submittedAt: 'created_at', decidedAt: 'acted_at', notes: 'comments', decision: (x) => x.action === 'reject' ? 'rejected' : 'approved', href: (x) => `/documents/${x.document_id}` })),
    ...donations.map((row) => decisionRow('donations', 'অনলাইন দান', row, { reference: 'confirmation_no', title: 'donor_name', submittedAt: 'created_at', decidedAt: 'reviewed_at', notes: 'review_notes', decision: (x) => x.status === 'rejected' ? 'rejected' : 'approved', href: () => '/public-inbox?tab=donations' })),
  ];
  rows.push(
    ...welfareReleases.map((row) => decisionRow('welfare-releases', 'Welfare releases', row, { reference: 'application_no', title: 'beneficiary_name', submittedAt: 'requested_at', decidedAt: 'decided_at', notes: 'decision_notes', decision: (x) => x.status === 'rejected' ? 'rejected' : 'approved', href: (x) => `/welfare/${x.application_id}` })),
    ...supplierPayments.map((row) => decisionRow('supplier-payments', 'Supplier payments', row, { reference: 'order_no', title: 'vendor_name', submittedAt: 'requested_at', decidedAt: 'decided_at', notes: 'decision_notes', decision: (x) => x.status === 'rejected' ? 'rejected' : 'approved', href: (x) => `/procurement/${x.request_id}` })),
    ...maintenanceCompletions.map((row) => decisionRow('maintenance-completions', 'Maintenance completions', row, { reference: 'work_order_no', title: 'work_title', submittedAt: 'requested_at', decidedAt: 'decided_at', notes: 'decision_notes', decision: (x) => x.status === 'rejected' ? 'rejected' : 'approved', href: (x) => `/maintenance/${x.work_order_id}` })),
    ...payrollPayments.map((row) => decisionRow('payroll-payments', 'Payroll payments', row, { reference: 'payroll_month', title: 'staff_name', submittedAt: 'requested_at', decidedAt: 'decided_at', notes: 'decision_notes', decision: (x) => x.status === 'rejected' ? 'rejected' : 'approved', href: (x) => `/staff-operations/payroll/${x.payroll_id}` })),
    ...treasuryTransfers.map((row) => decisionRow('treasury-transfers', 'Treasury transfers', row, { reference: 'reference', title: 'type', submittedAt: 'requested_at', decidedAt: 'decided_at', notes: 'decision_notes', decision: (x) => x.status === 'rejected' ? 'rejected' : 'approved', href: () => '/treasury/transfer' })),
  );
  if (filters.type) rows = rows.filter((row) => row.type === filters.type);
  if (filters.decision) rows = rows.filter((row) => row.decision === filters.decision);
  if (filters.from) rows = rows.filter((row) => String(row.decidedAt).slice(0, 10) >= filters.from);
  if (filters.to) rows = rows.filter((row) => String(row.decidedAt).slice(0, 10) <= filters.to);
  rows.sort((a, b) => new Date(b.decidedAt) - new Date(a.decidedAt));
  const decided = rows.length;
  return { rows, summary: { decided, approved: rows.filter((row) => row.decision === 'approved').length, rejected: rows.filter((row) => row.decision === 'rejected').length, withinSla: rows.filter((row) => row.withinSla).length, averageHours: decided ? rows.reduce((sum, row) => sum + row.responseHours, 0) / decided : 0 } };
}

function historyCsv(rows) {
  const quote = (value) => `"${String(value == null ? '' : value).replace(/"/g, '""')}"`;
  return ['Type,Reference,Title,Decision,Approver,Submitted,Decided,Response hours,SLA hours,Within SLA,Notes', ...rows.map((row) => [row.typeLabel, row.reference, row.title, row.decision, row.actorName, row.submittedAt, row.decidedAt, row.responseHours.toFixed(2), row.slaHours, row.withinSla ? 'Yes' : 'No', row.notes].map(quote).join(','))].join('\n');
}

module.exports = { get, summary, history, historyCsv };
