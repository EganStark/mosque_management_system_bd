require('dotenv').config();
const db = require('../src/config/db');
const backups = require('../src/services/backups');
const { validateProductionEnvironment } = require('../src/config/environment');

async function main() {
  if (process.env.NODE_ENV === 'production') validateProductionEnvironment(process.env);
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
