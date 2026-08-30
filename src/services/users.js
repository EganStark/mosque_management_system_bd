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

async function update(id, { name, username, email, role, is_active, password }) {
  const patch = { name, username, email, role, is_active, updated_at: db.fn.now() };
  if (password) patch.password_hash = await bcrypt.hash(password, SALT_ROUNDS);
  await db('users').where({ id }).update(patch);
  return findById(id);
}

async function remove(id) {
  return db('users').where({ id }).del();
}

module.exports = { ROLES, publicFields, findByUsername, findById, list, verifyPassword, create, update, remove };
