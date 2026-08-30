const db = require('../config/db');

function nullable(data, keys) {
  const out = { ...data };
  keys.forEach((key) => { if (out[key] === '' || out[key] === undefined) out[key] = null; });
  return out;
}

const categories = { all: () => db('asset_categories').where({ is_active: true }).orderBy('name') };

async function nextCode() {
  const row = await db('assets').select(db.raw("MAX(NULLIF(regexp_replace(asset_code, '[^0-9]', '', 'g'), '')::int) as max_no")).first();
  return `AST-${String(Number(row.max_no || 0) + 1).padStart(4, '0')}`;
}

async function list() {
  return db('assets as a').leftJoin('asset_categories as ac', 'a.category_id', 'ac.id').leftJoin('members as m', 'a.responsible_member_id', 'm.id')
    .select('a.*', 'ac.name as category_name', 'm.name as responsible_name').orderBy('a.id', 'desc');
}

async function find(id) {
  const asset = await db('assets as a').leftJoin('asset_categories as ac', 'a.category_id', 'ac.id').leftJoin('members as m', 'a.responsible_member_id', 'm.id')
    .select('a.*', 'ac.name as category_name', 'm.name as responsible_name', 'm.phone as responsible_phone').where('a.id', id).first();
  if (!asset) return null;
  asset.maintenance = await db('asset_maintenance').where({ asset_id: id }).orderBy('maintenance_date', 'desc');
  return asset;
}

async function create(data) {
  const payload = nullable(data, ['category_id', 'purchase_date', 'warranty_until', 'responsible_member_id', 'disposed_at']);
  return (await db('assets').insert(payload).returning('*'))[0];
}

async function update(id, data) {
  const payload = nullable(data, ['category_id', 'purchase_date', 'warranty_until', 'responsible_member_id', 'disposed_at']);
  await db('assets').where({ id }).update({ ...payload, updated_at: db.fn.now() });
  return find(id);
}

async function addMaintenance(assetId, data) {
  return (await db('asset_maintenance').insert(nullable({ asset_id: assetId, ...data }, ['next_maintenance_date'])).returning('*'))[0];
}

async function summary() {
  const [row] = await db('assets').select(db.raw("COUNT(*) FILTER (WHERE status='active')::int as active_count"), db.raw("COUNT(*) FILTER (WHERE condition IN ('needs_service','damaged'))::int as attention_count"), db.raw("COALESCE(SUM(purchase_price),0) as total_value"));
  const [maintenance] = await db('asset_maintenance').where('next_maintenance_date', '<=', db.raw("CURRENT_DATE + INTERVAL '30 days'" )).where('next_maintenance_date', '>=', db.raw('CURRENT_DATE')).count('* as c');
  return { activeCount: Number(row.active_count || 0), attentionCount: Number(row.attention_count || 0), totalValue: Number(row.total_value || 0), maintenanceDue: Number(maintenance.c || 0) };
}

module.exports = { categories, nextCode, list, find, create, update, addMaintenance, summary };
