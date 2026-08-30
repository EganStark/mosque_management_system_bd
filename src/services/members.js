const db = require('../config/db');

const MEMBER_COLUMNS = [
  'id_no', 'name', 'phone', 'other_phones', 'occupation_id', 'occupation_section',
  'gender', 'photo',
  'division_id', 'district_id', 'thana_id', 'post_office_id', 'village_id', 'area_id',
  'post_code', 'address_text',
  'wife_name', 'wife_die_date', 'husband_name', 'husband_die_date', 'spouse_photo',
  'father_name', 'father_birth_date', 'father_die_date', 'father_photo',
  'mother_name', 'mother_birth_date', 'mother_die_date', 'mother_photo',
  'grandfather_name', 'grandfather_die_date', 'grandmother_name', 'grandmother_die_date',
  'reference_member_id', 'status', 'birth_date', 'die_date',
  'monthly_payment', 'monthly_payment_amount',
];

// Convert '' to null for optional FK/date/number fields.
function clean(data) {
  const out = {};
  for (const key of MEMBER_COLUMNS) {
    let v = data[key];
    if (v === '' || v === undefined) v = null;
    out[key] = v;
  }
  return out;
}

async function list() {
  return db('members as m')
    .leftJoin('occupations as o', 'm.occupation_id', 'o.id')
    .select('m.id', 'm.id_no', 'm.name', 'm.phone', 'm.photo', 'm.address_text',
      'm.gender', 'm.status', 'm.monthly_payment', 'm.monthly_payment_amount', 'o.name as occupation')
    .orderBy('m.id_no', 'asc');
}

async function find(id) {
  return db('members').where({ id }).first();
}

/** Full member with joined location/occupation/reference names + children. */
async function findFull(id) {
  const m = await db('members as m')
    .leftJoin('occupations as o', 'm.occupation_id', 'o.id')
    .leftJoin('divisions as dv', 'm.division_id', 'dv.id')
    .leftJoin('districts as ds', 'm.district_id', 'ds.id')
    .leftJoin('thanas as th', 'm.thana_id', 'th.id')
    .leftJoin('post_offices as po', 'm.post_office_id', 'po.id')
    .leftJoin('villages as vl', 'm.village_id', 'vl.id')
    .leftJoin('areas as ar', 'm.area_id', 'ar.id')
    .leftJoin('members as ref', 'm.reference_member_id', 'ref.id')
    .select('m.*', 'o.name as occupation_name', 'dv.name as division_name',
      'ds.name as district_name', 'th.name as thana_name', 'po.name as post_office_name',
      'vl.name as village_name', 'ar.name as area_name',
      'ref.name as reference_name', 'ref.id_no as reference_id_no')
    .where('m.id', id)
    .first();
  if (!m) return null;
  m.children = await db('member_children').where({ member_id: id }).orderBy(['type', 'sl']);
  return m;
}

/** Next sequential id_no, zero-padded to 4 digits (matches reference style 0001..). */
async function nextIdNo() {
  const row = await db('members')
    .select(db.raw("MAX(NULLIF(regexp_replace(id_no, '[^0-9]', '', 'g'), '')::int) as max_no"))
    .first();
  const next = (row && row.max_no ? Number(row.max_no) : 0) + 1;
  return String(next).padStart(4, '0');
}

async function create(data, children = []) {
  return db.transaction(async (trx) => {
    const payload = clean(data);
    if (!payload.id_no) {
      const row = await trx('members')
        .select(trx.raw("MAX(NULLIF(regexp_replace(id_no, '[^0-9]', '', 'g'), '')::int) as max_no"))
        .first();
      payload.id_no = String((row && row.max_no ? Number(row.max_no) : 0) + 1).padStart(4, '0');
    }
    const [member] = await trx('members').insert(payload).returning('*');
    await insertChildren(trx, member.id, children);
    return member;
  });
}

async function update(id, data, children = null) {
  return db.transaction(async (trx) => {
    await trx('members').where({ id }).update(clean(data));
    if (children !== null) {
      await trx('member_children').where({ member_id: id }).del();
      await insertChildren(trx, id, children);
    }
    return trx('members').where({ id }).first();
  });
}

async function insertChildren(trx, memberId, children) {
  const rows = (children || [])
    .filter((c) => c && c.name && String(c.name).trim() !== '')
    .map((c) => ({
      member_id: memberId,
      type: c.type === 'daughter' ? 'daughter' : 'son',
      sl: c.sl || null,
      name: c.name,
      birth_date: c.birth_date || null,
      die_date: c.die_date || null,
      photo: c.photo || null,
    }));
  if (rows.length) await trx('member_children').insert(rows);
}

async function remove(id) {
  return db('members').where({ id }).del();
}

/** Lightweight options for Select2 reference/member pickers. */
async function options() {
  return db('members')
    .select('id', 'id_no', 'name', 'phone')
    .orderBy('id_no', 'asc');
}

async function counts() {
  const [total] = await db('members').count('* as c');
  const [active] = await db('members').where({ status: 'active' }).count('* as c');
  const [male] = await db('members').where({ gender: 'male' }).count('* as c');
  const [female] = await db('members').where({ gender: 'female' }).count('* as c');
  return {
    total: Number(total.c),
    active: Number(active.c),
    male: Number(male.c),
    female: Number(female.c),
  };
}

module.exports = { list, find, findFull, nextIdNo, create, update, remove, options, counts, MEMBER_COLUMNS };
