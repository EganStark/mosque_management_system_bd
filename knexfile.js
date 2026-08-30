require('dotenv').config();

const connection = process.env.DATABASE_URL || {
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'postgres',
  database: 'baitur_rahman',
};

const base = {
  client: 'pg',
  connection,
  pool: { min: 0, max: 10 },
  migrations: { directory: './migrations' },
  seeds: { directory: './seeds' },
};

module.exports = {
  development: base,
  production: base,
  test: {
    ...base,
    connection: process.env.TEST_DATABASE_URL || connection,
  },
};
