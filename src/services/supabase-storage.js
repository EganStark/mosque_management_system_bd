const { createClient } = require('@supabase/supabase-js');

let client;

function enabled() {
  return String(process.env.STORAGE_PROVIDER || 'local').toLowerCase() === 'supabase';
}

function supabaseUrl() {
  const raw = String(process.env.SUPABASE_URL || '').trim().replace(/^['"]|['"]$/g, '');
  if (!raw) throw new Error('SUPABASE_URL is required for Supabase storage');
  const candidate = /^[a-z][a-z\d+\-.]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    return new URL(candidate).toString();
  } catch {
    throw new Error('SUPABASE_URL must be a valid URL');
  }
}

function getClient() {
  if (!enabled()) throw new Error('Supabase storage is not enabled');
  if (!client) {
    client = createClient(supabaseUrl(), process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

function publicBucket() {
  return process.env.SUPABASE_PUBLIC_BUCKET || 'public-media';
}

function privateBucket() {
  return process.env.SUPABASE_PRIVATE_BUCKET || 'private-documents';
}

function backupBucket() {
  return process.env.SUPABASE_BACKUP_BUCKET || 'database-backups';
}

function objectKeyFromPublicUrl(value) {
  if (!enabled()) return null;
  try {
    const url = new URL(value);
    const base = new URL(supabaseUrl());
    if (url.origin !== base.origin) return null;
    const prefix = `/storage/v1/object/public/${encodeURIComponent(publicBucket())}/`;
    if (!url.pathname.startsWith(prefix)) return null;
    const key = decodeURIComponent(url.pathname.slice(prefix.length));
    return key && !key.includes('..') ? key : null;
  } catch {
    return null;
  }
}

async function uploadPublicImage(file, key) {
  const bucket = publicBucket();
  const { error } = await getClient().storage.from(bucket).upload(key, file.buffer, {
    contentType: file.mimetype,
    cacheControl: '31536000',
    upsert: false,
  });
  if (error) throw new Error(`Supabase image upload failed: ${error.message}`);
  const { data } = getClient().storage.from(bucket).getPublicUrl(key);
  return data.publicUrl;
}

async function removePublicImage(value) {
  const key = objectKeyFromPublicUrl(value);
  if (!key) return false;
  const { error } = await getClient().storage.from(publicBucket()).remove([key]);
  if (error) throw new Error(`Supabase image deletion failed: ${error.message}`);
  return true;
}

async function uploadPrivateDocument(file, key) {
  const { error } = await getClient().storage.from(privateBucket()).upload(key, file.buffer, {
    contentType: file.mimetype,
    cacheControl: '3600',
    upsert: false,
  });
  if (error) throw new Error(`Supabase document upload failed: ${error.message}`);
  return key;
}

async function downloadPrivateDocument(key) {
  const { data, error } = await getClient().storage.from(privateBucket()).download(key);
  if (error) throw new Error(`Supabase document download failed: ${error.message}`);
  return Buffer.from(await data.arrayBuffer());
}

async function removePrivateDocument(key) {
  if (!enabled() || !key || key.includes('..')) return false;
  const { error } = await getClient().storage.from(privateBucket()).remove([key]);
  if (error) throw new Error(`Supabase document deletion failed: ${error.message}`);
  return true;
}

async function uploadBackup(key, content) {
  const { error } = await getClient().storage.from(backupBucket()).upload(key, content, {
    contentType: 'application/json',
    cacheControl: '0',
    upsert: false,
  });
  if (error) throw new Error(`Supabase backup upload failed: ${error.message}`);
  return key;
}

async function listBackups(folder) {
  const { data, error } = await getClient().storage.from(backupBucket()).list(folder, {
    limit: 1000,
    sortBy: { column: 'created_at', order: 'desc' },
  });
  if (error) throw new Error(`Supabase backup listing failed: ${error.message}`);
  return data || [];
}

async function removeBackups(keys) {
  if (!keys.length) return [];
  const { data, error } = await getClient().storage.from(backupBucket()).remove(keys);
  if (error) throw new Error(`Supabase backup retention failed: ${error.message}`);
  return data || [];
}

async function verifyBuckets() {
  const expected = [
    [publicBucket(), true],
    [privateBucket(), false],
    [backupBucket(), false],
  ];
  for (const [name, shouldBePublic] of expected) {
    const { data, error } = await getClient().storage.getBucket(name);
    if (error || !data) throw new Error(`Supabase bucket is unavailable: ${name}`);
    if (Boolean(data.public) !== shouldBePublic) {
      throw new Error(`Supabase bucket ${name} must be ${shouldBePublic ? 'public' : 'private'}`);
    }
  }
  return true;
}

module.exports = {
  enabled,
  getClient,
  publicBucket,
  privateBucket,
  backupBucket,
  objectKeyFromPublicUrl,
  uploadPublicImage,
  removePublicImage,
  uploadPrivateDocument,
  downloadPrivateDocument,
  removePrivateDocument,
  uploadBackup,
  listBackups,
  removeBackups,
  verifyBuckets,
};
