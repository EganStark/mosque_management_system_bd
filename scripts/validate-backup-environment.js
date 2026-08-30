const required = [
  'PGHOST',
  'PGPORT',
  'PGUSER',
  'PGPASSWORD',
  'PGDATABASE',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
];

const missing = required.filter((name) => !process.env[name]);
if (missing.length) {
  console.error(`Missing backup setting(s): ${missing.join(', ')}`);
  process.exit(1);
}

if (process.env.PGUSER !== 'postgres.azdqiwvsxkgftslfvqrw') {
  console.error('Backup database username does not match the Supabase session pooler user.');
  process.exit(1);
}

if (!process.env.PGHOST.endsWith('.pooler.supabase.com')) {
  console.error('Backup database host is not a Supabase pooler host.');
  process.exit(1);
}

try {
  const url = new URL(process.env.SUPABASE_URL);
  if (url.protocol !== 'https:') throw new Error('protocol');
} catch {
  console.error('SUPABASE_URL is not a valid HTTPS URL.');
  process.exit(1);
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY.startsWith('sb_secret_')) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is not a current Supabase secret key.');
  process.exit(1);
}

console.log('Structured Supabase pooler configuration is present and valid.');
console.log(`Database target: ${process.env.PGUSER}@${process.env.PGHOST}:${process.env.PGPORT}/${process.env.PGDATABASE}`);
