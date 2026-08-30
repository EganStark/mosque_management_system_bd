const db = require('../config/db');

const types = {
  all: () => db('committee_types').where({ is_active: true }).orderBy('id'),
  create: async (data) => (await db('committee_types').insert(data).returning('*'))[0],
};

async function list() {
  return db('committees as c')
    .leftJoin('committee_members as cm', 'c.id', 'cm.committee_id')
    .select('c.*').count('cm.id as member_count')
    .groupBy('c.id').orderBy('c.start_date', 'desc');
}

async function find(id) {
  const committee = await db('committees').where({ id }).first();
  if (!committee) return null;
  committee.members = await db('committee_members as cm')
    .join('members as m', 'cm.member_id', 'm.id')
    .join('committee_types as ct', 'cm.committee_type_id', 'ct.id')
    .select('cm.*', 'm.name as member_name', 'm.id_no as member_id_no', 'm.phone', 'm.photo', 'ct.name as position_name')
    .where('cm.committee_id', id).orderBy('cm.sort_order').orderBy('cm.id');
  return committee;
}

async function create(data) {
  if (data.status === 'active') await db('committees').where({ status: 'active' }).update({ status: 'completed' });
  return (await db('committees').insert(data).returning('*'))[0];
}

async function addMember(committeeId, data) {
  return (await db('committee_members').insert({ committee_id: committeeId, ...data }).returning('*'))[0];
}

async function removeMember(committeeId, id) {
  return db('committee_members').where({ committee_id: committeeId, id }).del();
}

module.exports = { types, list, find, create, addMember, removeMember };
