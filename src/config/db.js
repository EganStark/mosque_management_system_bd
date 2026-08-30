const knex = require('knex');
const knexfile = require('../../knexfile');

const env = process.env.NODE_ENV || 'development';
const db = knex(knexfile[env] || knexfile.development);

module.exports = db;
