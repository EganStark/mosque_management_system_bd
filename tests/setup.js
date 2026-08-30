// Shared test bootstrap: point at the test DB, run migrations + seeds.
process.env.NODE_ENV = 'test';
process.env.TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  'postgres://postgres:postgres@localhost:5432/baitur_rahman_test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.SESSION_SECRET = 'test-session-secret';
process.env.CSRF_SECRET = 'test-csrf-secret';
process.env.ADMIN_USERNAME = 'admin';
process.env.ADMIN_PASSWORD = 'Admin@2026';

const db = require('../src/config/db');
const { ensureTestDatabase } = require('../scripts/ensure-test-db');

async function migrateAndSeed() {
  await ensureTestDatabase();
  await db.migrate.latest();
  await db.seed.run();
}

async function teardown() {
  await db.destroy();
}

/**
 * Extract the CSRF token from a fetched HTML page so POST requests pass
 * the double-submit-cookie check (the agent already holds the csrf cookie).
 */
function extractCsrf(html) {
  const m = html.match(/name="_csrf" value="([^"]+)"/);
  return m ? m[1] : '';
}

module.exports = { db, migrateAndSeed, teardown, extractCsrf };
