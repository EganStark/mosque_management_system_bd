-- Run this once from the Supabase SQL Editor after replacing the password.
-- Use a long password made from letters and numbers so the SQL literal is safe.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mosque_backup') THEN
    CREATE ROLE mosque_backup LOGIN;
  END IF;
END
$$;

ALTER ROLE mosque_backup WITH LOGIN PASSWORD 'REPLACE_WITH_A_LONG_RANDOM_PASSWORD';
ALTER ROLE mosque_backup BYPASSRLS;

GRANT CONNECT ON DATABASE postgres TO mosque_backup;
GRANT USAGE ON SCHEMA public TO mosque_backup;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO mosque_backup;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO mosque_backup;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT SELECT ON TABLES TO mosque_backup;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT SELECT ON SEQUENCES TO mosque_backup;
