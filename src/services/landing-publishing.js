const db = require('../config/db');
const TYPES = { events: { table: 'events', label: 'অনুষ্ঠান', labelEn: 'Events', title: 'title_bn', titleEn: 'title_en', edit: (id) => `/landing/events/${id}/edit` }, staff: { table: 'staff_members', label: 'স্টাফ', labelEn: 'Staff', title: 'name_bn', titleEn: 'name_en', edit: (id) => `/landing/staff/${id}/edit` }, announcements: { table: 'announcements', label: 'ঘোষণা', labelEn: 'Announcements', title: 'title_bn', titleEn: 'title_en', edit: (id) => `/landing/announcements/${id}/edit` }, gallery: { table: 'gallery_images', label: 'গ্যালারি', labelEn: 'Gallery', title: 'title_bn', titleEn: 'title_en', edit: (id) => `/landing/gallery/${id}/edit` }, faq: { table: 'faqs', label: 'FAQ', labelEn: 'FAQ', title: 'question_bn', titleEn: 'question_en', edit: (id) => `/landing/faq/${id}/edit` }, janaza: { table: 'janaza_notices', label: 'জানাযা', labelEn: 'Janaza', title: 'deceased_name_bn', titleEn: 'deceased_name_en', edit: (id) => `/landing/janaza/${id}/edit` } };

const REQUIRED_FIELDS = {
  events: { title_bn: 'বাংলা শিরোনাম', title_en: 'English title', description_bn: 'বাংলা বিবরণ', description_en: 'English description', event_date: 'তারিখ', event_time: 'সময়', location: 'স্থান' },
  staff: { name_bn: 'বাংলা নাম', name_en: 'English name', position_bn: 'বাংলা পদবি', position_en: 'English position' },
  announcements: { title_bn: 'বাংলা শিরোনাম', title_en: 'English title', content_bn: 'বাংলা বিবরণ', content_en: 'English content', publish_date: 'প্রকাশের তারিখ' },
  gallery: { title_bn: 'বাংলা শিরোনাম', title_en: 'English title', image_path: 'ছবি' },
  faq: { question_bn: 'বাংলা প্রশ্ন', question_en: 'English question', answer_bn: 'বাংলা উত্তর', answer_en: 'English answer' },
  janaza: { deceased_name_bn: 'বাংলা নাম', deceased_name_en: 'English name', janaza_date: 'তারিখ', janaza_time: 'সময়', location_bn: 'বাংলা স্থান', location_en: 'English location' },
};

function publicationIssues(type, item) {
  const fields = REQUIRED_FIELDS[type] || {};
  return Object.entries(fields).filter(([key]) => item[key] === null || item[key] === undefined || String(item[key]).trim() === '').map(([, label]) => label);
}
async function list(filters = {}) {
  const allowedPageSizes = [10, 25, 50, 100];
  const exportAll = filters.exportAll === true;
  const perPage = allowedPageSizes.includes(Number(filters.per_page)) ? Number(filters.per_page) : 25;
  const normalized = { q: String(filters.q || '').trim(), type: TYPES[filters.type] ? filters.type : '', status: ['draft', 'review', 'scheduled', 'published', 'expired', 'inactive', 'incomplete'].includes(filters.status) ? filters.status : '', per_page: perPage };
  const groups = await Promise.all(Object.entries(TYPES).map(async ([type, config]) => (await db(config.table).whereNull('deleted_at').orderBy('updated_at', 'desc')).map((row) => { const issues = publicationIssues(type, row); return { id: row.id, type, typeLabel: config.label, typeLabelEn: config.labelEn, title: row[config.title], titleEn: row[config.titleEn], status: row.publication_status, reviewStatus: row.review_status, reviewNotes: row.review_notes, reviewRequestedAt: row.review_requested_at, isActive: row.is_active, publishedAt: row.published_at, scheduledAt: row.scheduled_at, expiresAt: row.expires_at, updatedAt: row.updated_at, editHref: config.edit(row.id), issues, canPublish: issues.length === 0 }; })));
  const allItems = groups.flat().sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  const needle = normalized.q.toLocaleLowerCase();
  const filteredItems = allItems.filter((item) => (!normalized.type || item.type === normalized.type) && (!normalized.status || (normalized.status === 'inactive' ? !item.isActive : normalized.status === 'incomplete' ? !item.canPublish : normalized.status === 'review' ? item.reviewStatus === 'submitted' : item.status === normalized.status)) && (!needle || `${item.title || ''} ${item.titleEn || ''}`.toLocaleLowerCase().includes(needle)));
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / perPage));
  const requestedPage = Math.max(1, Number.parseInt(filters.page, 10) || 1);
  const page = Math.min(requestedPage, totalPages);
  const offset = (page - 1) * perPage;
  const makeHref = (targetPage) => { const params = new URLSearchParams(); if (normalized.q) params.set('q', normalized.q); if (normalized.type) params.set('type', normalized.type); if (normalized.status) params.set('status', normalized.status); params.set('per_page', String(perPage)); params.set('page', String(targetPage)); return `/landing/publishing?${params.toString()}`; };
  const pageStart = Math.max(1, page - 2); const pageEnd = Math.min(totalPages, page + 2); const links = [];
  for (let number = pageStart; number <= pageEnd; number += 1) links.push({ number, href: makeHref(number), active: number === page });
  const exportParams = new URLSearchParams(); if (normalized.q) exportParams.set('q', normalized.q); if (normalized.type) exportParams.set('type', normalized.type); if (normalized.status) exportParams.set('status', normalized.status);
  return { items: exportAll ? filteredItems : filteredItems.slice(offset, offset + perPage), filters: normalized, filteredCount: filteredItems.length, exportHref: `/landing/publishing/export.csv${exportParams.toString() ? `?${exportParams.toString()}` : ''}`, types: Object.entries(TYPES).map(([value, config]) => ({ value, label: config.label, labelEn: config.labelEn })), pagination: { page, perPage, totalPages, from: filteredItems.length ? offset + 1 : 0, to: Math.min(offset + perPage, filteredItems.length), previousHref: page > 1 ? makeHref(page - 1) : null, nextHref: page < totalPages ? makeHref(page + 1) : null, links }, summary: { total: allItems.length, published: allItems.filter((x) => x.status === 'published').length, drafts: allItems.filter((x) => x.status === 'draft').length, review: allItems.filter((x) => x.reviewStatus === 'submitted').length, scheduled: allItems.filter((x) => x.status === 'scheduled').length, expired: allItems.filter((x) => x.status === 'expired').length, incomplete: allItems.filter((x) => !x.canPublish).length, inactive: allItems.filter((x) => !x.isActive).length } };
}
async function changeStatus(trx, type, id, status, userId, scheduledAt = null) {
  const config = TYPES[type];
  if (!config || !['draft', 'published', 'scheduled'].includes(status)) throw new Error('Invalid publishing action');
  const scheduleDate = scheduledAt ? new Date(scheduledAt) : null;
  if (status === 'scheduled' && (!scheduleDate || Number.isNaN(scheduleDate.getTime()) || scheduleDate <= new Date())) throw new Error('Choose a future publishing date and time');
  const item = await trx(config.table).where({ id }).forUpdate().first();
  if (!item) throw new Error('Content not found');
  if (item.publication_status === status && status !== 'scheduled') return { item, changed: false };
  const issues = publicationIssues(type, item);
  if (status !== 'draft' && issues.length) throw new Error(`Complete the content before publishing: ${issues.join(', ')}`);
  const values = status === 'published'
    ? { publication_status: status, is_active: true, published_at: trx.fn.now(), published_by: userId, scheduled_at: null, expires_at: null, review_status: 'approved', reviewed_at: trx.fn.now(), reviewed_by: userId, review_notes: null, updated_at: trx.fn.now() }
    : status === 'scheduled'
      ? { publication_status: status, published_at: null, published_by: null, scheduled_at: scheduleDate, review_status: 'approved', reviewed_at: trx.fn.now(), reviewed_by: userId, review_notes: null, updated_at: trx.fn.now() }
      : { publication_status: status, published_at: null, published_by: null, scheduled_at: null, expires_at: null, review_status: 'draft', review_requested_at: null, review_requested_by: null, reviewed_at: null, reviewed_by: null, review_notes: null, updated_at: trx.fn.now() };
  await trx(config.table).where({ id }).update(values);
  const updated = await trx(config.table).where({ id }).first();
  await trx('landing_publication_events').insert({ content_type: type, content_id: id, content_title: item[config.title] || `#${id}`, previous_status: item.publication_status, new_status: status, acted_by: userId, snapshot: updated, action: 'status_change' });
  return { item: updated, changed: true };
}

async function setStatus(type, id, status, userId, scheduledAt = null) {
  const result = await db.transaction((trx) => changeStatus(trx, type, id, status, userId, scheduledAt));
  return result.item;
}

async function bulkSetStatus(selected, status, userId) {
  if (!['draft', 'published'].includes(status)) throw new Error('Choose a valid bulk action');
  const values = [...new Set((Array.isArray(selected) ? selected : [selected]).filter(Boolean).map(String))];
  if (!values.length) throw new Error('Select at least one content item');
  if (values.length > 100) throw new Error('A maximum of 100 items can be changed at once');
  const targets = values.map((value) => { const match = value.match(/^([a-z]+):(\d+)$/); if (!match || !TYPES[match[1]]) throw new Error('Invalid content selection'); return { type: match[1], id: Number(match[2]) }; });
  return db.transaction(async (trx) => {
    let changed = 0;
    for (const target of targets) { const result = await changeStatus(trx, target.type, target.id, status, userId); if (result.changed) changed += 1; }
    return { selected: targets.length, changed };
  });
}

async function requestReview(type, id, userId) {
  const config = TYPES[type]; if (!config) throw new Error('Invalid content type');
  return db.transaction(async (trx) => {
    const item = await trx(config.table).where({ id }).forUpdate().first(); if (!item) throw new Error('Content not found');
    if (item.publication_status !== 'draft') throw new Error('Only drafts can be submitted for review');
    const issues = publicationIssues(type, item); if (issues.length) throw new Error(`Complete the content before review: ${issues.join(', ')}`);
    await trx(config.table).where({ id }).update({ review_status: 'submitted', review_requested_at: trx.fn.now(), review_requested_by: userId, reviewed_at: null, reviewed_by: null, review_notes: null, updated_at: trx.fn.now() });
    const snapshot = await trx(config.table).where({ id }).first();
    await trx('landing_publication_events').insert({ content_type: type, content_id: id, content_title: item[config.title] || `#${id}`, previous_status: item.publication_status, new_status: item.publication_status, acted_by: userId, snapshot, action: 'review_requested' });
    return snapshot;
  });
}

async function requestChanges(type, id, notes, userId) {
  const config = TYPES[type]; if (!config) throw new Error('Invalid content type');
  const message = String(notes || '').trim(); if (message.length < 3) throw new Error('Add a short change request note');
  return db.transaction(async (trx) => {
    const item = await trx(config.table).where({ id }).forUpdate().first(); if (!item) throw new Error('Content not found');
    if (item.review_status !== 'submitted') throw new Error('Content is not awaiting review');
    await trx(config.table).where({ id }).update({ review_status: 'changes_requested', reviewed_at: trx.fn.now(), reviewed_by: userId, review_notes: message, updated_at: trx.fn.now() });
    const snapshot = await trx(config.table).where({ id }).first();
    await trx('landing_publication_events').insert({ content_type: type, content_id: id, content_title: item[config.title] || `#${id}`, previous_status: item.publication_status, new_status: item.publication_status, acted_by: userId, snapshot, action: 'changes_requested' });
    return snapshot;
  });
}

async function setExpiry(type, id, expiresAt, userId) {
  const config = TYPES[type]; if (!config) throw new Error('Invalid content type');
  const expiry = new Date(expiresAt); if (Number.isNaN(expiry.getTime()) || expiry <= new Date()) throw new Error('Choose a future expiration date and time');
  return db.transaction(async (trx) => {
    const item = await trx(config.table).where({ id }).forUpdate().first(); if (!item) throw new Error('Content not found');
    if (item.publication_status !== 'published') throw new Error('Only published content can be scheduled to expire');
    await trx(config.table).where({ id }).update({ expires_at: expiry, updated_at: trx.fn.now() });
    const snapshot = await trx(config.table).where({ id }).first();
    await trx('landing_publication_events').insert({ content_type: type, content_id: id, content_title: item[config.title] || `#${id}`, previous_status: 'published', new_status: 'published', acted_by: userId, snapshot, action: 'expiry_scheduled' });
    return snapshot;
  });
}

async function duplicate(type, id, userId) {
  const config = TYPES[type]; if (!config) throw new Error('Invalid content type');
  return db.transaction(async (trx) => {
    const source = await trx(config.table).where({ id }).whereNull('deleted_at').first(); if (!source) throw new Error('Content not found');
    const columnInfo = await trx(config.table).columnInfo();
    const excluded = new Set(['id', 'created_at', 'updated_at', 'publication_status', 'published_at', 'published_by', 'scheduled_at', 'expires_at', 'review_status', 'review_requested_at', 'review_requested_by', 'reviewed_at', 'reviewed_by', 'review_notes']);
    const values = {};
    for (const [key, value] of Object.entries(source)) if (columnInfo[key] && !excluded.has(key)) values[key] = value;
    values[config.title] = `${source[config.title]} (কপি)`;
    values[config.titleEn] = `${source[config.titleEn]} (Copy)`;
    values.publication_status = 'draft'; values.review_status = 'draft'; values.published_at = null; values.published_by = null; values.scheduled_at = null; values.expires_at = null;
    const [copy] = await trx(config.table).insert(values).returning('*');
    await trx('landing_publication_events').insert({ content_type: type, content_id: copy.id, content_title: copy[config.title], previous_status: null, new_status: 'draft', acted_by: userId, snapshot: copy, action: 'duplicated' });
    return { type, editHref: config.edit(copy.id), item: copy };
  });
}

async function publishDue() {
  let count = 0;
  for (const [type, config] of Object.entries(TYPES)) {
    count += await db.transaction(async (trx) => {
      const due = await trx(config.table).whereNull('deleted_at').where({ publication_status: 'scheduled' }).where('scheduled_at', '<=', trx.fn.now()).forUpdate().skipLocked();
      for (const item of due) {
        await trx(config.table).where({ id: item.id }).update({ publication_status: 'published', is_active: true, published_at: trx.fn.now(), published_by: null, scheduled_at: null, updated_at: trx.fn.now() });
        const snapshot = await trx(config.table).where({ id: item.id }).first();
        await trx('landing_publication_events').insert({ content_type: type, content_id: item.id, content_title: item[config.title] || `#${item.id}`, previous_status: 'scheduled', new_status: 'published', acted_by: null, snapshot, action: 'automatic_publish' });
      }
      return due.length;
    });
  }
  for (const [type, config] of Object.entries(TYPES)) {
    count += await db.transaction(async (trx) => {
      const expired = await trx(config.table).whereNull('deleted_at').where({ publication_status: 'published' }).whereNotNull('expires_at').where('expires_at', '<=', trx.fn.now()).forUpdate().skipLocked();
      for (const item of expired) {
        await trx(config.table).where({ id: item.id }).update({ publication_status: 'expired', expires_at: null, updated_at: trx.fn.now() });
        const snapshot = await trx(config.table).where({ id: item.id }).first();
        await trx('landing_publication_events').insert({ content_type: type, content_id: item.id, content_title: item[config.title] || `#${item.id}`, previous_status: 'published', new_status: 'expired', acted_by: null, snapshot, action: 'automatic_unpublish' });
      }
      return expired.length;
    });
  }
  return count;
}

async function preview(type, id) {
  const config = TYPES[type];
  if (!config) throw new Error('Invalid content type');
  const item = await db(config.table).where({ id }).whereNull('deleted_at').first();
  if (!item) return null;
  const issues = publicationIssues(type, item);
  return { type, typeLabel: config.label, editHref: config.edit(id), item, issues, canPublish: issues.length === 0 };
}

async function history(options = 100) {
  const input = typeof options === 'number' ? { limit: options } : (options || {});
  const allowedActions = ['status_change', 'automatic_publish', 'automatic_unpublish', 'expiry_scheduled', 'review_requested', 'changes_requested', 'restore', 'duplicated', 'archived', 'archive_restored'];
  const filters = { q: String(input.q || '').trim(), type: TYPES[input.type] ? input.type : '', action: allowedActions.includes(input.action) ? input.action : '' };
  const query = db('landing_publication_events as e').leftJoin('users as u', 'e.acted_by', 'u.id').select('e.*', 'u.name as actor_name', 'u.username as actor_username').orderBy('e.created_at', 'desc').limit(Math.min(Math.max(Number(input.limit) || 100, 1), 10000));
  if (filters.type) query.where('e.content_type', filters.type);
  if (filters.action) query.where('e.action', filters.action);
  if (filters.q) query.whereILike('e.content_title', `%${filters.q}%`);
  const rows = await query;
  return rows.map((row) => ({ ...row, typeLabel: TYPES[row.content_type]?.label || row.content_type, editHref: TYPES[row.content_type]?.edit(row.content_id) || null }));
}

function historyFilters(input = {}) { const allowedActions = ['status_change', 'automatic_publish', 'automatic_unpublish', 'expiry_scheduled', 'review_requested', 'changes_requested', 'restore', 'duplicated', 'archived', 'archive_restored']; return { q: String(input.q || '').trim(), type: TYPES[input.type] ? input.type : '', action: allowedActions.includes(input.action) ? input.action : '' }; }

function comparableValue(value) {
  if (value === null || value === undefined || value === '') return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

async function historyDetail(eventId) {
  const event = await db('landing_publication_events as e').leftJoin('users as u', 'e.acted_by', 'u.id').where('e.id', eventId).select('e.*', 'u.name as actor_name', 'u.username as actor_username').first();
  if (!event) return null;
  const previous = await db('landing_publication_events').where({ content_type: event.content_type, content_id: event.content_id }).where('id', '<', event.id).orderBy('id', 'desc').first();
  const before = previous?.snapshot || {};
  const after = event.snapshot || {};
  const ignored = new Set(['id', 'created_at', 'updated_at']);
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((key) => !ignored.has(key)).sort();
  const changes = keys.map((key) => ({ key, label: key.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()), before: comparableValue(before[key]), after: comparableValue(after[key]) })).filter((change) => change.before !== change.after);
  const config = TYPES[event.content_type];
  return { event: { ...event, typeLabel: config?.label || event.content_type, typeLabelEn: config?.labelEn || event.content_type, editHref: config?.edit(event.content_id) || null }, previous, changes };
}

function csvCell(value) { const text = value === null || value === undefined ? '' : String(value); return `"${text.replace(/"/g, '""')}"`; }
function queueCsv(data) {
  const header = ['ID', 'Type', 'Title (BN)', 'Title (EN)', 'Status', 'Active', 'Quality issues', 'Scheduled at', 'Expires at', 'Published at', 'Updated at'];
  const rows = data.items.map((item) => [item.id, item.typeLabelEn, item.title, item.titleEn, item.status, item.isActive ? 'Yes' : 'No', item.issues.join('; '), item.scheduledAt ? new Date(item.scheduledAt).toISOString() : '', item.expiresAt ? new Date(item.expiresAt).toISOString() : '', item.publishedAt ? new Date(item.publishedAt).toISOString() : '', item.updatedAt ? new Date(item.updatedAt).toISOString() : '']);
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
}
function historyCsv(events) {
  const header = ['Event ID', 'Content ID', 'Type', 'Title', 'Action', 'Previous status', 'New status', 'User', 'Time', 'Snapshot available'];
  const rows = events.map((event) => [event.id, event.content_id, event.typeLabel, event.content_title, event.action, event.previous_status, event.new_status, event.actor_name || event.actor_username || 'System', event.created_at ? new Date(event.created_at).toISOString() : '', event.snapshot ? 'Yes' : 'No']);
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
}

async function overview() {
  const [content, recentActivity] = await Promise.all([list({ exportAll: true }), history(6)]);
  const scheduled = content.items.filter((item) => item.status === 'scheduled').sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt)).slice(0, 5);
  const attention = content.items.filter((item) => item.status === 'draft' || !item.canPublish).sort((a, b) => Number(!b.canPublish) - Number(!a.canPublish) || Number(b.reviewStatus === 'submitted') - Number(a.reviewStatus === 'submitted') || new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, 5);
  return { summary: content.summary, scheduled, attention, recentActivity };
}

async function restore(eventId, userId) {
  return db.transaction(async (trx) => {
    const event = await trx('landing_publication_events').where({ id: eventId }).forUpdate().first();
    const config = event && TYPES[event.content_type];
    if (!event || !config || !event.snapshot) throw new Error('This history entry has no restorable snapshot');
    const current = await trx(config.table).where({ id: event.content_id }).forUpdate().first();
    if (!current) throw new Error('The original content no longer exists');
    const columnInfo = await trx(config.table).columnInfo();
    const excluded = new Set(['id', 'created_at', 'updated_at', 'publication_status', 'published_at', 'published_by', 'scheduled_at']);
    const restored = {};
    for (const [key, value] of Object.entries(event.snapshot)) if (columnInfo[key] && !excluded.has(key)) restored[key] = value;
    const values = { ...restored, publication_status: 'draft', published_at: null, published_by: null, scheduled_at: null, review_status: 'draft', review_requested_at: null, review_requested_by: null, reviewed_at: null, reviewed_by: null, review_notes: null, updated_at: trx.fn.now() };
    await trx(config.table).where({ id: event.content_id }).update(values);
    const snapshot = await trx(config.table).where({ id: event.content_id }).first();
    const [audit] = await trx('landing_publication_events').insert({ content_type: event.content_type, content_id: event.content_id, content_title: restored[config.title] || current[config.title] || `#${event.content_id}`, previous_status: current.publication_status, new_status: 'draft', acted_by: userId, snapshot, action: 'restore' }).returning('*');
    return audit;
  });
}

async function archive(type, id, userId) {
  const config = TYPES[type]; if (!config) throw new Error('Invalid content type');
  return db.transaction(async (trx) => {
    const item = await trx(config.table).where({ id }).whereNull('deleted_at').forUpdate().first();
    if (!item) throw new Error('Content not found');
    await trx(config.table).where({ id }).update({ deleted_at: trx.fn.now(), deleted_by: userId, publication_status: 'draft', published_at: null, published_by: null, scheduled_at: null, expires_at: null, review_status: 'draft', review_requested_at: null, review_requested_by: null, reviewed_at: null, reviewed_by: null, review_notes: null, updated_at: trx.fn.now() });
    const snapshot = await trx(config.table).where({ id }).first();
    await trx('landing_publication_events').insert({ content_type: type, content_id: id, content_title: item[config.title] || `#${id}`, previous_status: item.publication_status, new_status: 'draft', acted_by: userId, snapshot, action: 'archived' });
    return snapshot;
  });
}

async function archived(input = {}) {
  const perPage = [10, 25, 50, 100].includes(Number(input.per_page)) ? Number(input.per_page) : 25;
  const filters = { q: String(input.q || '').trim(), type: TYPES[input.type] ? input.type : '', per_page: perPage };
  const groups = await Promise.all(Object.entries(TYPES).map(async ([type, config]) => {
    const rows = await db(`${config.table} as c`).leftJoin('users as u', 'c.deleted_by', 'u.id').whereNotNull('c.deleted_at').select('c.id', 'c.deleted_at', 'u.name as deleted_by_name').select({ content_title: `c.${config.title}`, content_title_en: `c.${config.titleEn}` });
    return rows.map((row) => ({ ...row, type, typeLabel: config.label, typeLabelEn: config.labelEn }));
  }));
  const needle = filters.q.toLocaleLowerCase();
  const allItems = groups.flat().sort((a, b) => new Date(b.deleted_at) - new Date(a.deleted_at));
  const filtered = allItems.filter((item) => (!filters.type || item.type === filters.type) && (!needle || `${item.content_title || ''} ${item.content_title_en || ''}`.toLocaleLowerCase().includes(needle)));
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const page = Math.min(Math.max(1, Number.parseInt(input.page, 10) || 1), totalPages);
  const offset = (page - 1) * perPage;
  const href = (target) => { const params = new URLSearchParams(); if (filters.q) params.set('q', filters.q); if (filters.type) params.set('type', filters.type); params.set('per_page', perPage); params.set('page', target); return `/landing/archive?${params}`; };
  return { items: filtered.slice(offset, offset + perPage), filters, types: Object.entries(TYPES).map(([value, config]) => ({ value, label: config.label, labelEn: config.labelEn })), total: filtered.length, pagination: { page, totalPages, from: filtered.length ? offset + 1 : 0, to: Math.min(offset + perPage, filtered.length), previousHref: page > 1 ? href(page - 1) : null, nextHref: page < totalPages ? href(page + 1) : null } };
}

async function restoreArchived(type, id, userId) {
  const config = TYPES[type]; if (!config) throw new Error('Invalid content type');
  return db.transaction(async (trx) => {
    const item = await trx(config.table).where({ id }).whereNotNull('deleted_at').forUpdate().first();
    if (!item) throw new Error('Archived content not found');
    await trx(config.table).where({ id }).update({ deleted_at: null, deleted_by: null, publication_status: 'draft', published_at: null, published_by: null, scheduled_at: null, expires_at: null, review_status: 'draft', review_requested_at: null, review_requested_by: null, reviewed_at: null, reviewed_by: null, review_notes: null, updated_at: trx.fn.now() });
    const snapshot = await trx(config.table).where({ id }).first();
    await trx('landing_publication_events').insert({ content_type: type, content_id: id, content_title: item[config.title] || `#${id}`, previous_status: 'draft', new_status: 'draft', acted_by: userId, snapshot, action: 'archive_restored' });
    return snapshot;
  });
}

async function restoreArchivedBulk(selected, userId) {
  const values = [...new Set((Array.isArray(selected) ? selected : [selected]).filter(Boolean).map(String))];
  if (!values.length) throw new Error('Select at least one archived item');
  if (values.length > 100) throw new Error('A maximum of 100 items can be restored at once');
  const targets = values.map((value) => { const match = value.match(/^([a-z]+):(\d+)$/); if (!match || !TYPES[match[1]]) throw new Error('Invalid archive selection'); return { type: match[1], id: Number(match[2]) }; });
  for (const target of targets) await restoreArchived(target.type, target.id, userId);
  return { restored: targets.length };
}

module.exports = { TYPES, list, setStatus, bulkSetStatus, requestReview, requestChanges, setExpiry, duplicate, publishDue, preview, history, historyFilters, historyDetail, restore, archive, archived, restoreArchived, restoreArchivedBulk, publicationIssues, queueCsv, historyCsv, overview };
