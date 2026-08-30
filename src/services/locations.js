// CRUD + cascading queries for the geographic master data and occupations.
const db = require('../config/db');

// Each level: table name, parent column (null for top), and a human label.
const LEVELS = {
  division: { table: 'divisions', parent: null },
  district: { table: 'districts', parent: 'division_id' },
  thana: { table: 'thanas', parent: 'district_id' },
  post_office: { table: 'post_offices', parent: 'thana_id' },
  village: { table: 'villages', parent: 'post_office_id' },
  area: { table: 'areas', parent: 'village_id' },
};

function table(level) {
  if (!LEVELS[level]) throw new Error(`Unknown location level: ${level}`);
  return LEVELS[level].table;
}

async function all(level) {
  return db(table(level)).orderBy('name');
}

async function byParent(level, parentId) {
  const cfg = LEVELS[level];
  if (!cfg.parent) return all(level);
  return db(cfg.table).where(cfg.parent, parentId).orderBy('name');
}

/** List rows joined with their parent name, for management tables. */
async function listWithParent(level) {
  const cfg = LEVELS[level];
  if (!cfg.parent) return db(cfg.table).orderBy('name');
  const parentLevel = Object.keys(LEVELS).find((k) => LEVELS[k].table + '_id_placeholder');
  const parentTable = parentTableFor(level);
  return db(`${cfg.table} as c`)
    .leftJoin(`${parentTable} as p`, `c.${cfg.parent}`, 'p.id')
    .select('c.*', 'p.name as parent_name')
    .orderBy('c.name');
}

function parentTableFor(level) {
  const order = ['division', 'district', 'thana', 'post_office', 'village', 'area'];
  const idx = order.indexOf(level);
  return LEVELS[order[idx - 1]].table;
}

async function create(level, data) {
  const [row] = await db(table(level)).insert(data).returning('*');
  return row;
}

async function update(level, id, data) {
  await db(table(level)).where({ id }).update(data);
  return db(table(level)).where({ id }).first();
}

async function remove(level, id) {
  return db(table(level)).where({ id }).del();
}

async function find(level, id) {
  return db(table(level)).where({ id }).first();
}

// --- Occupations (separate, flat) ---
const occupations = {
  all: () => db('occupations').orderBy('name'),
  find: (id) => db('occupations').where({ id }).first(),
  create: async (name) => (await db('occupations').insert({ name }).returning('*'))[0],
  update: async (id, name) => {
    await db('occupations').where({ id }).update({ name });
    return db('occupations').where({ id }).first();
  },
  remove: (id) => db('occupations').where({ id }).del(),
};

module.exports = { LEVELS, all, byParent, listWithParent, create, update, remove, find, occupations };
