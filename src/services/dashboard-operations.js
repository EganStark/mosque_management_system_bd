const db = require('../config/db');
const security = require('./security');

async function count(table, configure) {
  const query = db(table);
  if (configure) configure(query);
  const row = await query.count('* as total').first();
  return Number(row.total || 0);
}

async function get(role = 'viewer', userId = null) {
  const permissionKeys = ['members.manage', 'finance.manage', 'monthly.manage', 'people.manage', 'assets.manage', 'website.manage', 'reports.view'];
  const permissionValues = await Promise.all(permissionKeys.map((key) => security.allowed(role, key)));
  const capabilities = Object.fromEntries(permissionKeys.map((key, index) => [key, permissionValues[index]]));
  const [publicMessages, onlineDonations, welfarePending, welfareUrgent, procurementApproval,
    documentsPending, bookingPending, inventoryLow, maintenanceCritical, maintenanceOverdue,
    meetingActionsOverdue, taskOverdue, payrollPending, upcomingMeetings, deliveryDue, openActions, taskQueue] = await Promise.all([
    count('public_contact_messages', (q) => q.where({ status: 'new' })),
    count('online_donation_submissions', (q) => q.where({ status: 'pending' })),
    count('welfare_applications', (q) => q.where({ status: 'pending' })),
    count('welfare_applications', (q) => q.where({ status: 'pending', urgency: 'emergency' })),
    count('purchase_requests', (q) => q.where({ status: 'submitted' })),
    count('document_records', (q) => q.where({ status: 'pending' })),
    count('facility_bookings', (q) => q.where({ status: 'pending' })),
    count('inventory_items', (q) => q.where({ is_active: true }).whereRaw('stock_quantity <= reorder_level')),
    count('maintenance_work_orders', (q) => q.where({ priority: 'critical' }).whereNotIn('status', ['completed', 'cancelled'])),
    count('maintenance_work_orders', (q) => q.whereNotIn('status', ['completed', 'cancelled']).where('scheduled_date', '<', db.raw('CURRENT_DATE'))),
    count('meeting_action_items', (q) => q.whereIn('status', ['open', 'in_progress', 'blocked']).where('due_date', '<', db.raw('CURRENT_DATE'))),
    count('mosque_tasks', (q) => q.whereIn('status', ['open', 'in_progress', 'blocked']).where('due_date', '<', db.raw('CURRENT_DATE'))),
    count('staff_payrolls', (q) => q.whereIn('status', ['unpaid', 'partial'])),
    db('committee_meetings as m').join('committees as c', 'm.committee_id', 'c.id')
      .select('m.id', 'm.meeting_no', 'm.title', 'm.meeting_date', 'm.start_time', 'c.name as committee_name')
      .where('m.status', 'scheduled').where('m.meeting_date', '>=', db.raw('CURRENT_DATE')).orderBy('m.meeting_date').limit(5),
    db('purchase_orders as o').join('maintenance_vendors as v', 'o.vendor_id', 'v.id')
      .select('o.id', 'o.request_id', 'o.order_no', 'o.expected_delivery', 'v.name as vendor_name')
      .where('o.status', 'issued').whereNotNull('o.expected_delivery').where('o.expected_delivery', '<=', db.raw("CURRENT_DATE + INTERVAL '7 days'"))
      .orderBy('o.expected_delivery').limit(5),
    db('meeting_action_items as a').join('committee_meetings as m', 'a.meeting_id', 'm.id')
      .select('a.id', 'a.meeting_id', 'a.title', 'a.due_date', 'a.priority', 'a.status', 'm.meeting_no')
      .whereIn('a.status', ['open', 'in_progress', 'blocked']).orderByRaw('a.due_date ASC NULLS LAST').limit(5),
    db('mosque_tasks as t').leftJoin('users as u', 't.assigned_user_id', 'u.id')
      .select('t.id', 't.task_no', 't.title', 't.due_date', 't.priority', 't.status', 'u.name as assigned_name')
      .whereIn('t.status', ['open', 'in_progress', 'blocked'])
      .modify((q) => { if (userId) q.orderByRaw('CASE WHEN t.assigned_user_id = ? THEN 0 ELSE 1 END', [userId]); })
      .orderByRaw("CASE t.priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END")
      .orderByRaw('t.due_date ASC NULLS LAST').limit(5),
  ]);

  const can = (permission) => capabilities[permission];
  const approvals = [
    { label: 'অনলাইন দান যাচাই', labelEn: 'Donation verification', count: onlineDonations, href: '/public-inbox?tab=donations', icon: 'verified_user', permission: 'people.manage' },
    { label: 'ক্রয় অনুমোদন', labelEn: 'Purchase approval', count: procurementApproval, href: '/procurement', icon: 'shopping_cart_checkout', permission: 'finance.manage' },
    { label: 'কল্যাণ আবেদন', labelEn: 'Welfare applications', count: welfarePending, href: '/welfare', icon: 'volunteer_activism', permission: 'finance.manage' },
    { label: 'নথি অনুমোদন', labelEn: 'Document approval', count: documentsPending, href: '/documents?status=pending', icon: 'approval', permission: 'people.manage' },
    { label: 'বুকিং অনুমোদন', labelEn: 'Booking approval', count: bookingPending, href: '/bookings?status=pending', icon: 'event_available', permission: 'people.manage' },
  ].filter((item) => can(item.permission));
  const alerts = [];
  const addAlert = (condition, alert) => { if (condition && can(alert.permission)) alerts.push(alert); };
  addAlert(welfareUrgent, { severity: 'danger', count: welfareUrgent, title: 'জরুরি কল্যাণ আবেদন', titleEn: 'Urgent welfare requests', detail: `${welfareUrgent}টি আবেদন দ্রুত যাচাই প্রয়োজন`, detailEn: `${welfareUrgent} applications need immediate review`, href: '/welfare', permission: 'finance.manage' });
  addAlert(maintenanceCritical, { severity: 'danger', count: maintenanceCritical, title: 'জরুরি রক্ষণাবেক্ষণ', titleEn: 'Critical maintenance', detail: `${maintenanceCritical}টি গুরুত্বপূর্ণ কাজ অসম্পন্ন`, detailEn: `${maintenanceCritical} critical work orders remain open`, href: '/maintenance', permission: 'assets.manage' });
  addAlert(maintenanceOverdue, { severity: 'warning', count: maintenanceOverdue, title: 'সময় পেরোনো রক্ষণাবেক্ষণ', titleEn: 'Overdue maintenance', detail: `${maintenanceOverdue}টি কাজ নির্ধারিত সময় পেরিয়েছে`, detailEn: `${maintenanceOverdue} work orders are overdue`, href: '/maintenance', permission: 'assets.manage' });
  addAlert(meetingActionsOverdue, { severity: 'warning', count: meetingActionsOverdue, title: 'সভায় নির্ধারিত কাজ বকেয়া', titleEn: 'Overdue meeting actions', detail: `${meetingActionsOverdue}টি করণীয় সময়মতো শেষ হয়নি`, detailEn: `${meetingActionsOverdue} meeting actions missed their deadline`, href: '/governance-meetings', permission: 'people.manage' });
  addAlert(taskOverdue, { severity: 'warning', count: taskOverdue, title: 'সময় পেরোনো সাধারণ কাজ', titleEn: 'Overdue operational tasks', detail: `${taskOverdue}টি সাধারণ কাজ নির্ধারিত সময় পেরিয়েছে`, detailEn: `${taskOverdue} operational tasks are overdue`, href: '/tasks', permission: 'people.manage' });
  addAlert(inventoryLow, { severity: 'warning', count: inventoryLow, title: 'কম মজুত', titleEn: 'Low inventory', detail: `${inventoryLow}টি আইটেম পুনঃঅর্ডার সীমায়`, detailEn: `${inventoryLow} items reached their reorder level`, href: '/inventory', permission: 'assets.manage' });
  addAlert(publicMessages, { severity: 'info', count: publicMessages, title: 'নতুন পাবলিক বার্তা', titleEn: 'New public messages', detail: `${publicMessages}টি বার্তা উত্তর পায়নি`, detailEn: `${publicMessages} public messages are unanswered`, href: '/public-inbox', permission: 'people.manage' });
  addAlert(payrollPending, { severity: 'info', count: payrollPending, title: 'বেতন বকেয়া', titleEn: 'Outstanding payroll', detail: `${payrollPending}টি পে-রোল সম্পূর্ণ পরিশোধ হয়নি`, detailEn: `${payrollPending} payroll records are not fully paid`, href: '/staff-operations', permission: 'people.manage' });
  const visibleMeetings = can('people.manage') ? upcomingMeetings : [];
  const visibleDeliveries = can('finance.manage') ? deliveryDue : [];
  const visibleActions = can('people.manage') ? openActions : [];
  const visibleTasks = can('people.manage') ? taskQueue : [];
  const attentionTotal = alerts.reduce((sum, item) => sum + item.count, 0);
  const urgentTotal = alerts.filter((item) => item.severity === 'danger').reduce((sum, item) => sum + item.count, 0);
  const approvalTotal = approvals.reduce((sum, item) => sum + item.count, 0);
  return { approvals, alerts, attentionTotal, urgentTotal, approvalTotal, upcomingMeetings: visibleMeetings, deliveryDue: visibleDeliveries, openActions: visibleActions, taskQueue: visibleTasks, capabilities };
}

module.exports = { get };
