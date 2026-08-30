const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const db = require('../config/db');
const supabaseStorage = require('./supabase-storage');

const FORMAT = 'brjm-backup';
const VERSION = 1;
const TABLES = [
  'users', 'user_notification_states', 'user_pinned_items', 'user_search_history', 'user_dashboard_preferences', 'occupations', 'divisions', 'districts', 'thanas', 'post_offices', 'villages', 'areas',
  'members', 'member_children', 'banks', 'bank_transactions', 'expense_heads', 'expenses',
  'book_types', 'book_numbers', 'collection_categories', 'collections', 'monthly_bills', 'monthly_payments', 'management_targets', 'budget_lines', 'accounting_periods', 'accounting_period_events',
  'asset_categories', 'assets', 'asset_maintenance', 'committee_types', 'committees', 'committee_members',
  'committee_meetings', 'meeting_attendees', 'meeting_resolutions', 'meeting_action_items',
  'mosque_tasks', 'mosque_task_updates', 'mosque_task_checklist_items', 'mosque_task_templates', 'mosque_task_template_items',
  'document_records', 'document_versions', 'document_attachments', 'document_approvals',
  'staff_members', 'prayer_settings', 'events', 'announcements', 'gallery_images', 'faqs',
  'deceased_records', 'janaza_notices', 'company_settings', 'role_permissions', 'treasury_transfers',
  'bank_reconciliations', 'communication_templates', 'communications',
  'mosque_programs', 'program_enrollments', 'program_attendance',
  'facilities', 'facility_bookings', 'facility_booking_payments',
  'welfare_beneficiaries', 'welfare_applications', 'welfare_disbursements',
  'staff_duty_rosters', 'staff_attendance', 'staff_payrolls', 'staff_payroll_payments',
  'maintenance_vendors', 'maintenance_work_orders', 'audit_logs',
  'purchase_requests', 'purchase_request_items', 'procurement_quotations', 'purchase_orders', 'goods_receipts', 'purchase_payments',
  'inventory_categories', 'inventory_items', 'inventory_movements',
  'public_contact_messages', 'online_donation_submissions',
];
const REQUIRED = ['users', 'members', 'collections', 'expenses', 'company_settings'];
const RECOVERY_DIR = process.env.BACKUP_STORAGE_DIR
  ? path.resolve(process.env.BACKUP_STORAGE_DIR)
  : path.resolve(__dirname, '..', '..', 'storage', 'backups');

function digest(data) { return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex'); }
function fileStamp(date = new Date()) { return date.toISOString().replace(/[:.]/g, '-'); }

async function exportData(client = db) {
  const tables = {};
  for (const table of TABLES) {
    if (await client.schema.hasTable(table)) tables[table] = await client(table).select('*').orderBy('id');
  }
  const payload = { format: FORMAT, version: VERSION, createdAt: new Date().toISOString(), database: 'Baitur Rahman Mosque Management', tables };
  return { ...payload, checksum: digest(payload) };
}

function validate(payload) {
  if (!payload || payload.format !== FORMAT || payload.version !== VERSION || !payload.tables) throw new Error('Unsupported backup file');
  const { checksum, ...unsigned } = payload;
  if (!checksum || digest(unsigned) !== checksum) throw new Error('Backup checksum mismatch');
  for (const table of REQUIRED) if (!Array.isArray(payload.tables[table])) throw new Error(`Required table missing: ${table}`);
  for (const [table, rows] of Object.entries(payload.tables)) {
    if (!TABLES.includes(table) || !Array.isArray(rows)) throw new Error(`Invalid table data: ${table}`);
  }
  return true;
}

async function saveRecoverySnapshot() {
  const snapshot = await exportData();
  const filename = `pre-restore-${fileStamp()}.json`;
  if (supabaseStorage.enabled()) {
    const key = `recovery/${filename}`;
    await supabaseStorage.uploadBackup(key, Buffer.from(JSON.stringify(snapshot, null, 2)));
    return { filename, target: `supabase://${supabaseStorage.backupBucket()}/${key}` };
  }
  await fs.mkdir(RECOVERY_DIR, { recursive: true });
  const target = path.join(RECOVERY_DIR, filename);
  await fs.writeFile(target, JSON.stringify(snapshot, null, 2), { encoding: 'utf8', flag: 'wx' });
  return { filename, target };
}

async function createAutomatedBackup(options = {}) {
  const directory = path.resolve(options.directory || RECOVERY_DIR);
  const retentionDays = Math.max(1, Math.min(3650, Number(options.retentionDays || 30)));
  const now = options.now || new Date();
  const payload = await exportData(options.client || db);
  validate(payload);
  await fs.mkdir(directory, { recursive: true });
  const filename = `brjm-auto-${fileStamp(now)}.json`;
  if (supabaseStorage.enabled() && !options.directory) {
    const key = `automated/${filename}`;
    await supabaseStorage.uploadBackup(key, Buffer.from(JSON.stringify(payload)));
    const cutoff = now.getTime() - retentionDays * 24 * 60 * 60 * 1000;
    const entries = await supabaseStorage.listBackups('automated');
    const expired = entries.filter((entry) => entry.name !== filename && /^brjm-auto-.*\.json$/.test(entry.name) && new Date(entry.created_at).getTime() < cutoff);
    const expiredKeys = expired.map((entry) => `automated/${entry.name}`);
    await supabaseStorage.removeBackups(expiredKeys);
    return { filename, target: `supabase://${supabaseStorage.backupBucket()}/${key}`, removed: expired.map((entry) => entry.name), createdAt: payload.createdAt, checksum: payload.checksum };
  }
  const target = path.join(directory, filename);
  const temporary = `${target}.${crypto.randomBytes(8).toString('hex')}.tmp`;
  await fs.writeFile(temporary, JSON.stringify(payload), { encoding: 'utf8', flag: 'wx' });
  await fs.rename(temporary, target);

  const cutoff = now.getTime() - retentionDays * 24 * 60 * 60 * 1000;
  const removed = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    if (!entry.isFile() || !/^brjm-auto-.*\.json$/.test(entry.name) || entry.name === filename) continue;
    const candidate = path.join(directory, entry.name);
    const stat = await fs.stat(candidate);
    if (stat.mtimeMs < cutoff) {
      await fs.unlink(candidate);
      removed.push(entry.name);
    }
  }
  return { filename, target, removed, createdAt: payload.createdAt, checksum: payload.checksum };
}

async function restore(payload) {
  validate(payload);
  const recovery = await saveRecoverySnapshot();
  await db.transaction(async (trx) => {
    for (const table of [...TABLES].reverse()) {
      if (payload.tables[table] && await trx.schema.hasTable(table)) await trx(table).del();
    }
    for (const table of TABLES) {
      const rows = payload.tables[table];
      if (rows && rows.length) await trx.batchInsert(table, rows, 250);
    }
    for (const table of TABLES) {
      if (!payload.tables[table] || !(await trx.schema.hasColumn(table, 'id'))) continue;
      await trx.raw(`SELECT setval(pg_get_serial_sequence(?, 'id'), COALESCE((SELECT MAX(id) FROM ??), 1), COALESCE((SELECT MAX(id) FROM ??), 0) > 0)`, [table, table, table]);
    }
    await trx.raw("SELECT setval('collection_receipt_seq', COALESCE(MAX(substring(receipt_no from '([0-9]+)$')::bigint), 1), COUNT(*) > 0) FROM collections WHERE receipt_no ~ '[0-9]+$'");
    await trx.raw("SELECT setval('expense_voucher_seq', COALESCE(MAX(substring(voucher_no from '([0-9]+)$')::bigint), 1), COUNT(*) > 0) FROM expenses WHERE voucher_no ~ '[0-9]+$'");
    await trx.raw("SELECT setval('facility_booking_no_seq', COALESCE(MAX(substring(booking_no from '([0-9]+)$')::bigint), 1), COUNT(*) > 0) FROM facility_bookings WHERE booking_no ~ '[0-9]+$'");
    await trx.raw("SELECT setval('welfare_application_no_seq', COALESCE(MAX(substring(application_no from '([0-9]+)$')::bigint), 1), COUNT(*) > 0) FROM welfare_applications WHERE application_no ~ '[0-9]+$'");
    await trx.raw("SELECT setval('maintenance_work_order_seq', COALESCE(MAX(substring(work_order_no from '([0-9]+)$')::bigint), 1), COUNT(*) > 0) FROM maintenance_work_orders WHERE work_order_no ~ '[0-9]+$'");
    await trx.raw("SELECT setval('committee_meeting_no_seq', COALESCE(MAX(substring(meeting_no from '([0-9]+)$')::bigint), 1), COUNT(*) > 0) FROM committee_meetings WHERE meeting_no ~ '[0-9]+$'");
    await trx.raw("SELECT setval('document_reference_seq', COALESCE(MAX(substring(reference_no from '([0-9]+)$')::bigint), 1), COUNT(*) > 0) FROM document_records WHERE reference_no ~ '[0-9]+$'");
    await trx.raw("SELECT setval('purchase_request_no_seq', COALESCE(MAX(substring(request_no from '([0-9]+)$')::bigint), 1), COUNT(*) > 0) FROM purchase_requests WHERE request_no ~ '[0-9]+$'");
    await trx.raw("SELECT setval('purchase_order_no_seq', COALESCE(MAX(substring(order_no from '([0-9]+)$')::bigint), 1), COUNT(*) > 0) FROM purchase_orders WHERE order_no ~ '[0-9]+$'");
    await trx.raw("SELECT setval('goods_receipt_no_seq', COALESCE(MAX(substring(receipt_no from '([0-9]+)$')::bigint), 1), COUNT(*) > 0) FROM goods_receipts WHERE receipt_no ~ '[0-9]+$'");
    await trx.raw("SELECT setval('inventory_item_code_seq', COALESCE(MAX(substring(item_code from '([0-9]+)$')::bigint), 1), COUNT(*) > 0) FROM inventory_items WHERE item_code ~ '[0-9]+$'");
    await trx.raw("SELECT setval('inventory_movement_ref_seq', COALESCE(MAX(substring(reference_no from '([0-9]+)$')::bigint), 1), COUNT(*) > 0) FROM inventory_movements WHERE reference_no ~ '[0-9]+$'");
    await trx.raw("SELECT setval('public_contact_ticket_seq', COALESCE(MAX(substring(ticket_no from '([0-9]+)$')::bigint), 1), COUNT(*) > 0) FROM public_contact_messages WHERE ticket_no ~ '[0-9]+$'");
    await trx.raw("SELECT setval('online_donation_confirmation_seq', COALESCE(MAX(substring(confirmation_no from '([0-9]+)$')::bigint), 1), COUNT(*) > 0) FROM online_donation_submissions WHERE confirmation_no ~ '[0-9]+$'");
  });
  return recovery;
}

async function stats() {
  const result = {};
  for (const table of TABLES) if (await db.schema.hasTable(table)) { const row = await db(table).count('* as count').first(); result[table] = Number(row.count || 0); }
  let recoveryFiles = [];
  if (supabaseStorage.enabled()) {
    try { recoveryFiles = (await supabaseStorage.listBackups('recovery')).filter((item) => item.name.endsWith('.json')).map((item) => item.name); } catch (_) { recoveryFiles = []; }
  } else {
    try { recoveryFiles = (await fs.readdir(RECOVERY_DIR)).filter((name) => name.endsWith('.json')).sort().reverse(); } catch (_) { recoveryFiles = []; }
  }
  return { tables: result, totalRows: Object.values(result).reduce((sum, count) => sum + count, 0), recoveryFiles: recoveryFiles.slice(0, 10) };
}

module.exports = { FORMAT, VERSION, TABLES, exportData, validate, restore, stats, createAutomatedBackup };
