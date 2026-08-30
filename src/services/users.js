const bcrypt = require('bcryptjs');
const db = require('../config/db');

const SALT_ROUNDS = 10;
const ROLES = ['admin', 'collector', 'viewer'];

function publicFields(user) {
  if (!user) return null;
  const { password_hash, ...rest } = user;
  return rest;
}

async function findByUsername(username) {
  return db('users').whereRaw('LOWER(username) = LOWER(?)', [username]).first();
}

async function findById(id) {
  return db('users').where({ id }).first();
}

async function list() {
  return db('users').orderBy('id', 'asc');
}

async function verifyPassword(user, password) {
  if (!user) return false;
  return bcrypt.compare(password, user.password_hash);
}

async function create({ name, username, email, password, role, is_active = true }) {
  const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
  const [row] = await db('users')
    .insert({ name, username, email, password_hash, role, is_active })
    .returning('*');
  return publicFields(row);
}

async function update(id, { name, username, email, role, password }, actorId) {
  return db.transaction(async (trx) => {
    const user = await trx('users').where({ id }).forUpdate().first();
    if (!user) throw new Error('User not found');

    if (user.role === 'admin' && role !== 'admin' && user.is_active) {
      if (Number(user.id) === Number(actorId)) {
        throw new Error('You cannot remove your own administrator role');
      }
      const [{ count }] = await trx('users')
        .where({ role: 'admin', is_active: true })
        .count('* as count');
      if (Number(count) <= 1) throw new Error('At least one active administrator is required');
    }

    const patch = { name, username, email, role, updated_at: trx.fn.now() };
    if (password) patch.password_hash = await bcrypt.hash(password, SALT_ROUNDS);
    await trx('users').where({ id }).update(patch);
    return publicFields(await trx('users').where({ id }).first());
  });
}

async function setActive(id, isActive, actorId) {
  return db.transaction(async (trx) => {
    const user = await trx('users').where({ id }).forUpdate().first();
    if (!user) throw new Error('User not found');
    if (Boolean(user.is_active) === Boolean(isActive)) return publicFields(user);

    if (!isActive) {
      if (Number(user.id) === Number(actorId)) {
        throw new Error('You cannot deactivate your own account');
      }
      if (user.role === 'admin') {
        const [{ count }] = await trx('users')
          .where({ role: 'admin', is_active: true })
          .count('* as count');
        if (Number(count) <= 1) throw new Error('At least one active administrator is required');
      }
    }

    await trx('users').where({ id }).update({
      is_active: Boolean(isActive),
      updated_at: trx.fn.now(),
    });
    return publicFields(await trx('users').where({ id }).first());
  });
}

module.exports = {
  ROLES,
  publicFields,
  findByUsername,
  findById,
  list,
  verifyPassword,
  create,
  update,
  setActive,
};
