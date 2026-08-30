require('dotenv').config();
const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const bcrypt = require('bcryptjs');
const { validateProductionEnvironment } = require('../src/config/environment');

async function assertWritableDirectory(name, directory) {
  await fs.mkdir(directory, { recursive: true });
  const probe = path.join(directory, `.preflight-${crypto.randomBytes(8).toString('hex')}`);
  await fs.writeFile(probe, 'ok', { flag: 'wx' });
  await fs.unlink(probe);
  console.log(`✓ ${name} is writable: ${directory}`);
}

async function main() {
  validateProductionEnvironment(process.env);
  console.log('✓ Production environment is valid');

  // Require the database only after environment validation, so an invalid
  // release cannot accidentally connect using development defaults.
  const db = require('../src/config/db');
  try {
    await db.raw('SELECT 1');
    console.log('✓ PostgreSQL is reachable');

    const [, pending] = await db.migrate.list();
    if (pending.length) throw new Error(`${pending.length} database migration(s) are pending`);
    console.log('✓ Database migrations are current');

    const admin = await db('users').where({ username: process.env.ADMIN_USERNAME || 'admin' }).first();
    if (!admin || !admin.is_active) throw new Error('An active administrator account was not found');
    const knownDefaults = ['ChangeMe@123', 'Admin@2026', 'admin'];
    for (const password of knownDefaults) {
      if (await bcrypt.compare(password, admin.password_hash || admin.password)) {
        throw new Error('Administrator still uses a known default password; change it before deployment');
      }
    }
    console.log('✓ Administrator account is active and does not use a known default password');

    if (process.env.STORAGE_PROVIDER === 'supabase') {
      const supabaseStorage = require('../src/services/supabase-storage');
      await supabaseStorage.verifyBuckets();
      console.log('✓ Supabase public, private, and backup buckets are configured');
    } else {
      await assertWritableDirectory('Image storage', path.resolve(process.env.IMAGE_UPLOAD_DIR));
      await assertWritableDirectory('Document storage', path.resolve(process.env.DOCUMENT_STORAGE_DIR));
      await assertWritableDirectory('Recovery backup storage', path.resolve(process.env.BACKUP_STORAGE_DIR));
    }
  } finally {
    await db.destroy();
  }
  console.log('Production preflight passed.');
}

main().catch((error) => {
  console.error(`Production preflight failed: ${error.message}`);
  process.exitCode = 1;
});
