// Creates the application database if it does not already exist.
// Connects to the maintenance database (PGADMIN_URL) and issues CREATE DATABASE.
require('dotenv').config();
const { Client } = require('pg');

const adminUrl =
  process.env.PGADMIN_URL || 'postgres://postgres:postgres@localhost:5432/postgres';
const dbName = process.env.DB_NAME || 'baitur_rahman';

(async () => {
  const client = new Client({ connectionString: adminUrl });
  try {
    await client.connect();
    const exists = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (exists.rowCount > 0) {
      console.log(`Database "${dbName}" already exists.`);
    } else {
      // dbName comes from env/config, not user input; quote-escape defensively.
      await client.query(`CREATE DATABASE "${dbName.replace(/"/g, '""')}"`);
      console.log(`Database "${dbName}" created.`);
    }
  } catch (err) {
    console.error('Failed to create database:', err.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
})();
