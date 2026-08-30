require('dotenv').config();
const db = require('../src/config/db');
const backups = require('../src/services/backups');
const { validateProductionEnvironment } = require('../src/config/environment');

function requireUrl(name, protocols) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} secret is missing`);
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} secret is not a valid URL`);
  }
  if (!protocols.includes(parsed.protocol)) throw new Error(`${name} uses an unsupported protocol`);
}

function validateBackupEnvironment() {
  requireUrl('DATABASE_URL', ['postgres:', 'postgresql:']);
  requireUrl('SUPABASE_URL', ['https:']);
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY.length < 32) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY secret is missing or incomplete');
  }
}

async function main() {
  if (process.env.NODE_ENV === 'production') validateProductionEnvironment(process.env);
  if (String(process.env.STORAGE_PROVIDER).toLowerCase() === 'supabase') validateBackupEnvironment();
  const result = await backups.createAutomatedBackup({
    directory: process.env.BACKUP_STORAGE_DIR,
    retentionDays: process.env.BACKUP_RETENTION_DAYS || 30,
  });
  console.log(`Database backup created: ${result.target}`);
  console.log(`Checksum: ${result.checksum}`);
  if (result.removed.length) console.log(`Removed ${result.removed.length} expired automated backup(s).`);
}

main()
  .catch((error) => {
    console.error(`Database backup failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => db.destroy());
