function postgresConnection(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) return null;

  const connection = { connectionString };

  // Supabase's shared pooler requires TLS. Its managed certificate chain is
  // not available in Render's trust store, so keep transport encryption on
  // while disabling CA verification for this database connection only.
  if (process.env.NODE_ENV === 'production') {
    connection.ssl = { rejectUnauthorized: false };
  }

  return connection;
}

module.exports = { postgresConnection };
