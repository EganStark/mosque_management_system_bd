exports.up = async (knex) => {
  await knex.raw(`
    CREATE OR REPLACE FUNCTION guard_closed_accounting_period() RETURNS trigger AS $$
    DECLARE transaction_date date;
    BEGIN
      transaction_date := ((to_jsonb(NEW) ->> TG_ARGV[0])::date);
      IF transaction_date IS NOT NULL AND EXISTS (
        SELECT 1 FROM accounting_periods
        WHERE period_month = date_trunc('month', transaction_date)::date AND status = 'closed'
      ) THEN
        RAISE EXCEPTION 'Accounting period % is closed', to_char(transaction_date, 'YYYY-MM') USING ERRCODE = 'P0001';
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);
  const guarded = [
    ['collections', 'date'], ['expenses', 'date'], ['treasury_transfers', 'date'],
    ['mosque_loans', 'issue_date'], ['loan_repayments', 'payment_date'],
  ];
  for (const [table, column] of guarded) {
    await knex.raw(`CREATE TRIGGER ${table}_closed_period_guard BEFORE INSERT OR UPDATE ON ${table} FOR EACH ROW EXECUTE FUNCTION guard_closed_accounting_period('${column}')`);
  }
};

exports.down = async (knex) => {
  for (const table of ['collections', 'expenses', 'treasury_transfers', 'mosque_loans', 'loan_repayments']) {
    await knex.raw(`DROP TRIGGER IF EXISTS ${table}_closed_period_guard ON ${table}`);
  }
  await knex.raw('DROP FUNCTION IF EXISTS guard_closed_accounting_period()');
};
