function postgresConnection(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) {
    if (!process.env.PGHOST || !process.env.PGUSER || !process.env.PGPASSWORD) return null;
    return {
      host: process.env.PGHOST,
      port: Number(process.env.PGPORT || 5432),
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      database: process.env.PGDATABASE || 'postgres',
      ssl: { rejectUnauthorized: false },
    };
  }

  let normalizedConnectionString = connectionString;
  let url;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL URL');
  }
  const usesSupabasePooler = url.hostname.endsWith('.pooler.supabase.com');
  const requiresManagedTls = process.env.NODE_ENV === 'production' || usesSupabasePooler;

  // Supabase's shared pooler requires TLS. Its managed certificate chain is
  // not available in Render's trust store, so keep transport encryption on
  // while disabling CA verification for this database connection only. The
  // pg driver treats sslmode=require as verify-full and lets that URI option
  // override this explicit SSL object, so remove the conflicting query flag.
  if (requiresManagedTls) {
    url.searchParams.delete('sslmode');
    url.searchParams.delete('uselibpqcompat');
    normalizedConnectionString = url.toString();
  }

  const connection = { connectionString: normalizedConnectionString };
  if (requiresManagedTls) connection.ssl = { rejectUnauthorized: false };

  return connection;
}

module.exports = { postgresConnection };
