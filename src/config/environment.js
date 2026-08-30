const path = require('path');

const PLACEHOLDER_PARTS = [
  'change-this',
  'changeme',
  'example.com',
  'localhost',
  '127.0.0.1',
  'dev-session',
  'fallback-csrf',
];

function isPlaceholder(value) {
  const normalized = String(value || '').toLowerCase();
  return PLACEHOLDER_PARTS.some((part) => normalized.includes(part));
}

function parseUrl(name, value, protocols, errors) {
  try {
    const parsed = new URL(value);
    if (!protocols.includes(parsed.protocol)) errors.push(`${name} must use ${protocols.join(' or ')}`);
    return parsed;
  } catch {
    errors.push(`${name} must be a valid URL`);
    return null;
  }
}

function validateProductionEnvironment(env = process.env) {
  const errors = [];
  const secrets = ['SESSION_SECRET', 'CSRF_SECRET', 'SUBMISSION_HASH_SECRET'];
  for (const name of secrets) {
    const value = env[name];
    if (!value || value.length < 32 || isPlaceholder(value)) {
      errors.push(`${name} must be a non-placeholder value of at least 32 characters`);
    }
  }
  const secretValues = secrets.map((name) => env[name]).filter(Boolean);
  if (new Set(secretValues).size !== secretValues.length) errors.push('Production secrets must use different values');

  if (!env.DATABASE_URL) errors.push('DATABASE_URL is required');
  else parseUrl('DATABASE_URL', env.DATABASE_URL, ['postgres:', 'postgresql:'], errors);

  const origins = String(env.LANDING_PAGE_ORIGIN || '').split(',').map((value) => value.trim()).filter(Boolean);
  if (!origins.length) errors.push('LANDING_PAGE_ORIGIN is required');
  for (const origin of origins) parseUrl('LANDING_PAGE_ORIGIN', origin, ['https:'], errors);
  if (!env.LANDING_PAGE_URL) errors.push('LANDING_PAGE_URL is required');
  else parseUrl('LANDING_PAGE_URL', env.LANDING_PAGE_URL, ['https:'], errors);

  if (!['true', 'false'].includes(String(env.TRUST_PROXY || '').toLowerCase())) {
    errors.push('TRUST_PROXY must be explicitly set to true or false');
  }
  const storageProvider = String(env.STORAGE_PROVIDER || '').toLowerCase();
  if (!['local', 'supabase'].includes(storageProvider)) errors.push('STORAGE_PROVIDER must be local or supabase');
  if (storageProvider === 'local') {
    for (const name of ['IMAGE_UPLOAD_DIR', 'DOCUMENT_STORAGE_DIR', 'BACKUP_STORAGE_DIR']) {
      if (!env[name] || !path.isAbsolute(env[name])) errors.push(`${name} must be an explicit absolute path`);
    }
  }
  if (storageProvider === 'supabase') {
    if (!env.SUPABASE_URL) errors.push('SUPABASE_URL is required for Supabase storage');
    else parseUrl('SUPABASE_URL', env.SUPABASE_URL, ['https:'], errors);
    if (!env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY.length < 32) {
      errors.push('SUPABASE_SERVICE_ROLE_KEY is required and must remain server-only');
    }
    for (const name of ['SUPABASE_PUBLIC_BUCKET', 'SUPABASE_PRIVATE_BUCKET', 'SUPABASE_BACKUP_BUCKET']) {
      if (!env[name]) errors.push(`${name} is required for Supabase storage`);
    }
  }
  if (env.SMS_GATEWAY_ENABLED === 'true') {
    if (!env.SMS_GATEWAY_URL) errors.push('SMS_GATEWAY_URL is required when SMS is enabled');
    else parseUrl('SMS_GATEWAY_URL', env.SMS_GATEWAY_URL, ['https:'], errors);
    if (!env.SMS_GATEWAY_TOKEN) errors.push('SMS_GATEWAY_TOKEN is required when SMS is enabled');
  }
  if (String(env.DEMO_MODE || '').toLowerCase() === 'true') {
    if (!env.DEMO_USERNAME || String(env.DEMO_USERNAME).trim().length < 3) {
      errors.push('DEMO_USERNAME must contain at least 3 characters when demo mode is enabled');
    }
    if (String(env.DEMO_USERNAME || '').toLowerCase() === String(env.ADMIN_USERNAME || '').toLowerCase()) {
      errors.push('DEMO_USERNAME must be different from ADMIN_USERNAME');
    }
    if (!env.DEMO_PASSWORD || env.DEMO_PASSWORD.length < 12 || isPlaceholder(env.DEMO_PASSWORD)) {
      errors.push('DEMO_PASSWORD must be a non-placeholder value of at least 12 characters');
    }
  }
  if (env.DEMO_DATA_ENABLED && !['true', 'false'].includes(String(env.DEMO_DATA_ENABLED).toLowerCase())) {
    errors.push('DEMO_DATA_ENABLED must be true or false');
  }
  if (String(env.DEMO_DATA_ENABLED || '').toLowerCase() === 'true'
    && String(env.DEMO_MODE || '').toLowerCase() !== 'true') {
    errors.push('DEMO_DATA_ENABLED requires DEMO_MODE=true');
  }

  if (errors.length) throw new Error(`Invalid production environment:\n- ${errors.join('\n- ')}`);
  return true;
}

module.exports = { validateProductionEnvironment };
