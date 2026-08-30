const db = require('../config/db');
const dashboardOperations = require('./dashboard-operations');
const security = require('./security');
const landingPublishing = require('./landing-publishing');
const cache = new Map();
const TTL = 15000;

async function operational(role) {
  const hit = cache.get(role);
  if (hit && Date.now() - hit.at < TTL) return hit.value;
  const value = await dashboardOperations.get(role);
  cache.set(role, { at: Date.now(), value });
  return value;
}
function itemKey(prefix, href) { return `${prefix}:${Buffer.from(href).toString('base64url')}`; }
function dateText(value) { if (!value) return ''; if (!(value instanceof Date)) return String(value).slice(0, 10); const pad = (number) => String(number).padStart(2, '0'); return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`; }
async function personalTasks(userId) {
  const rows = await db('mosque_tasks').where({ assigned_user_id: userId }).whereIn('status', ['open', 'in_progress', 'blocked']).select('id', 'task_no', 'title', 'status', 'priority', 'due_date').orderByRaw("CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END").orderByRaw('due_date ASC NULLS LAST').limit(20);
  const today = new Date(); const todayText = dateText(today); const soon = new Date(today); soon.setDate(soon.getDate() + 3); const soonText = dateText(soon);
  return rows.map((task) => { const due = dateText(task.due_date); let stage = 'assigned', severity = 'info', title = 'আপনার জন্য নির্ধারিত কাজ', titleEn = 'Task assigned to you', detail = `${task.task_no} · ${task.title}`, detailEn = `${task.task_no} · ${task.title}`; if (due && due < todayText) { stage = 'overdue'; severity = 'danger'; title = 'আপনার কাজের সময় পেরিয়েছে'; titleEn = 'Your task is overdue'; detail = `${task.task_no} · ${task.title} · শেষ ${due}`; detailEn = `${task.task_no} · ${task.title} · due ${due}`; } else if (due === todayText) { stage = 'today'; severity = 'danger'; title = 'আজ কাজটি শেষ করতে হবে'; titleEn = 'Task due today'; } else if (due && due <= soonText) { stage = 'upcoming'; severity = 'warning'; title = 'কাজের সময়সীমা কাছাকাছি'; titleEn = 'Task deadline approaching'; detail = `${task.task_no} · ${task.title} · শেষ ${due}`; detailEn = `${task.task_no} · ${task.title} · due ${due}`; } return { key: `task:${task.id}:${stage}`, kind: 'task', severity, count: 1, title, titleEn, detail, detailEn, href: `/tasks/${task.id}` }; });
}
async function contentReviews(user) {
  const [canManage, canPublish] = await Promise.all([security.allowed(user.role, 'website.manage'), security.allowed(user.role, 'website.publish')]);
  if (!canManage && !canPublish) return [];
  const groups = await Promise.all(Object.entries(landingPublishing.TYPES).map(async ([type, config]) => {
    const query = db(config.table).select('id', config.title, 'review_status', 'review_requested_at', 'review_requested_by', 'reviewed_at', 'review_notes').whereIn('review_status', ['submitted', 'changes_requested']).orderBy('updated_at', 'desc').limit(20);
    if (!canPublish) query.where({ review_status: 'changes_requested', review_requested_by: user.id });
    const rows = await query;
    return rows.flatMap((row) => {
      if (row.review_status === 'submitted' && canPublish) return [{ key: `content-review:${type}:${row.id}:submitted:${new Date(row.review_requested_at).getTime()}`, kind: 'approval', severity: 'approval', count: 1, title: 'কনটেন্ট অনুমোদনের অপেক্ষায়', titleEn: 'Content awaiting approval', detail: `${config.label} · ${row[config.title]}`, detailEn: `${config.labelEn} · ${row[config.title]}`, href: `/landing/publishing/${type}/${row.id}/preview` }];
      if (row.review_status === 'changes_requested' && row.review_requested_by === user.id) return [{ key: `content-review:${type}:${row.id}:changes:${new Date(row.reviewed_at).getTime()}`, kind: 'content', severity: 'warning', count: 1, title: 'কনটেন্টে পরিবর্তন চাওয়া হয়েছে', titleEn: 'Content changes requested', detail: `${config.label} · ${row[config.title]} · ${row.review_notes || ''}`, detailEn: `${config.labelEn} · ${row[config.title]} · ${row.review_notes || ''}`, href: `/landing/publishing/${type}/${row.id}/preview` }];
      return [];
    });
  }));
  return groups.flat().slice(0, 30);
}
async function list(user, limit) {
  const [operations, taskItems, reviewItems] = await Promise.all([operational(user.role), personalTasks(user.id), contentReviews(user)]);
  const severityRank = { danger: 0, warning: 1, approval: 2, info: 3 };
  const items = [
    ...taskItems,
    ...reviewItems,
    ...operations.alerts.map(item => ({ ...item, key: itemKey('alert', item.href), kind: 'alert' })),
    ...operations.approvals.filter(item => item.count > 0).map(item => ({ ...item, key: itemKey('approval', item.href), kind: 'approval', severity: 'approval', title: item.label, titleEn: item.labelEn, detail: `${item.count}টি অনুমোদন অপেক্ষমাণ`, detailEn: `${item.count} approvals are waiting` })),
  ].sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
  const states = items.length ? await db('user_notification_states').where({ user_id: user.id }).whereIn('notification_key', items.map(item => item.key)) : [];
  const stateMap = new Map(states.map(state => [state.notification_key, state]));
  const enriched = items.map(item => { const state = stateMap.get(item.key); return { ...item, unread: !state || item.count > Number(state.last_seen_count || 0) }; });
  const result = { items: limit ? enriched.slice(0, limit) : enriched, unreadCount: enriched.filter(item => item.unread).length, totalCount: enriched.length };
  return result;
}
async function markRead(user, key) { const data = await list(user); const item = data.items.find(entry => entry.key === key); if (!item) return null; const values = { user_id: user.id, notification_key: key, last_seen_count: item.count, read_at: db.fn.now(), updated_at: db.fn.now() }; await db('user_notification_states').insert(values).onConflict(['user_id', 'notification_key']).merge(values); return item; }
async function markAll(user) { const data = await list(user); if (!data.items.length) return 0; await db.transaction(async trx => { for (const item of data.items) { const values = { user_id: user.id, notification_key: item.key, last_seen_count: item.count, read_at: trx.fn.now(), updated_at: trx.fn.now() }; await trx('user_notification_states').insert(values).onConflict(['user_id', 'notification_key']).merge(values); } }); return data.items.length; }
module.exports = { list, markRead, markAll };
