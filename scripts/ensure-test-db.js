require('dotenv').config();
const { Client } = require('pg');

function config() {
  const target = new URL(process.env.TEST_DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/baitur_rahman_test');
  const name = decodeURIComponent(target.pathname.replace(/^\//, ''));
  if (!name || !/_test$/i.test(name)) throw new Error(`Refusing test bootstrap for unsafe database name "${name}"; it must end with _test`);
  const admin = new URL(target.toString());
  admin.pathname = '/postgres';
  return { target: target.toString(), admin: admin.toString(), name };
}

async function ensureTestDatabase() {
  const { admin, name } = config();
  const client = new Client({ connectionString: admin });
  await client.connect();
  try {
    const found = await client.query('SELECT 1 FROM pg_database WHERE datname=$1', [name]);
    if (!found.rowCount) {
      await client.query(`CREATE DATABASE "${name.replace(/"/g, '""')}"`);
      console.log(`Created isolated test database "${name}".`);
    }
    return name;
  } finally { await client.end(); }
}

if (require.main === module) ensureTestDatabase().then((name) => console.log(`Test database "${name}" is ready.`)).catch((err) => { console.error(err.message); process.exitCode = 1; });
module.exports = { ensureTestDatabase, config };
