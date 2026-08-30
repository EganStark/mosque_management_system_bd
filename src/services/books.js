// Receipt-book types and book numbers (Administrator Settings).
const db = require('../config/db');

const types = {
  all: () => db('book_types').orderBy('name'),
  find: (id) => db('book_types').where({ id }).first(),
  create: async (data) => (await db('book_types').insert(data).returning('*'))[0],
  update: async (id, data) => {
    await db('book_types').where({ id }).update(data);
    return db('book_types').where({ id }).first();
  },
  remove: (id) => db('book_types').where({ id }).del(),
};

const numbers = {
  list: () =>
    db('book_numbers as bn')
      .leftJoin('book_types as bt', 'bn.book_type_id', 'bt.id')
      .leftJoin('users as u', 'bn.collector_id', 'u.id')
      .select('bn.*', 'bt.name as book_type_name', 'u.name as collector_name')
      .orderBy('bn.id', 'desc'),
  find: (id) => db('book_numbers').where({ id }).first(),
  create: async (data) => (await db('book_numbers').insert(data).returning('*'))[0],
  update: async (id, data) => {
    await db('book_numbers').where({ id }).update(data);
    return db('book_numbers').where({ id }).first();
  },
  remove: (id) => db('book_numbers').where({ id }).del(),
  // Active books for the collection form dropdown.
  active: () =>
    db('book_numbers as bn')
      .leftJoin('book_types as bt', 'bn.book_type_id', 'bt.id')
      .where('bn.status', 'active')
      .select('bn.id', 'bn.book_number', 'bn.receipt_from', 'bn.receipt_to', 'bt.name as book_type_name')
      .orderBy('bn.id', 'desc'),
};

module.exports = { types, numbers };
