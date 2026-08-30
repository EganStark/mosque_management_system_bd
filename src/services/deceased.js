const db = require('../config/db');

async function list() {
  return db('deceased_records as d').join('members as m', 'd.member_id', 'm.id').leftJoin('janaza_notices as j', 'd.id', 'j.deceased_record_id')
    .select('d.*', 'm.name as member_name', 'm.id_no as member_id_no', 'm.phone', 'm.photo', 'j.id as notice_id', 'j.is_active as notice_active').orderBy('d.death_date', 'desc');
}

async function find(id) {
  return db('deceased_records as d').join('members as m', 'd.member_id', 'm.id').leftJoin('janaza_notices as j', 'd.id', 'j.deceased_record_id')
    .select('d.*', 'm.name as member_name', 'm.id_no as member_id_no', 'm.phone', 'm.photo', 'm.father_name', 'm.mother_name', 'm.address_text', 'j.id as notice_id', 'j.is_active as notice_active')
    .where('d.id', id).first();
}

async function mark(data, userId) {
  return db.transaction(async (trx) => {
    const member = await trx('members').where({ id: data.member_id }).forUpdate().first();
    if (!member) throw new Error('Member not found');
    const existing = await trx('deceased_records').where({ member_id: member.id }).first();
    if (existing) throw new Error('Member already recorded as deceased');
    await trx('members').where({ id: member.id }).update({ status: 'deactive', die_date: data.death_date, monthly_payment: false, updated_at: trx.fn.now() });
    const deathMonth = `${String(data.death_date).slice(0, 7)}-01`;
    await trx('monthly_bills').where({ member_id: member.id, status: 'unpaid' }).where('billing_month', '>=', deathMonth).update({ status: 'cancelled', updated_at: trx.fn.now() });
    const [record] = await trx('deceased_records').insert({ member_id: member.id, death_date: data.death_date, death_place: data.death_place || null, death_cause: data.death_cause || null, janaza_date: data.janaza_date || null, janaza_time: data.janaza_time || null, janaza_location: data.janaza_location || null, burial_date: data.burial_date || null, burial_location: data.burial_location || null, contact_person: data.contact_person || null, contact_phone: data.contact_phone || null, notes: data.notes || null, created_by: userId }).returning('*');
    if (data.publish_notice === 'true' && data.janaza_date && data.janaza_time && data.janaza_location) {
      await trx('janaza_notices').insert({ deceased_record_id: record.id, deceased_name_bn: member.name, deceased_name_en: data.deceased_name_en || member.name, janaza_date: data.janaza_date, janaza_time: data.janaza_time, location_bn: data.janaza_location, location_en: data.janaza_location_en || data.janaza_location, message_bn: data.message_bn || null, message_en: data.message_en || null, is_active: true });
    }
    return record;
  });
}

module.exports = { list, find, mark };
