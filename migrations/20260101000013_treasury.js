exports.up = async (knex) => {
  await knex.schema.alterTable('banks', (t) => {
    t.string('account_number');
    t.string('branch_name');
    t.decimal('opening_balance', 14, 2).notNullable().defaultTo(0);
    t.date('opening_balance_date');
    t.boolean('is_active').notNullable().defaultTo(true);
  });
  await knex.schema.createTable('treasury_transfers', (t) => {
    t.increments('id').primary();
    t.string('type').notNullable();
    t.integer('from_bank_id').references('id').inTable('banks').onDelete('RESTRICT');
    t.integer('to_bank_id').references('id').inTable('banks').onDelete('RESTRICT');
    t.decimal('amount', 14, 2).notNullable();
    t.date('date').notNullable();
    t.string('reference');
    t.text('remarks');
    t.string('status').notNullable().defaultTo('posted');
    t.integer('created_by').references('id').inTable('users').onDelete('SET NULL');
    t.timestamp('cancelled_at');
    t.integer('cancelled_by').references('id').inTable('users').onDelete('SET NULL');
    t.text('cancellation_reason');
    t.timestamps(true, true);
    t.index(['date', 'status']);
  });
  await knex.schema.createTable('bank_reconciliations', (t) => {
    t.increments('id').primary();
    t.integer('bank_id').notNullable().references('id').inTable('banks').onDelete('CASCADE');
    t.date('statement_date').notNullable();
    t.decimal('system_balance', 14, 2).notNullable();
    t.decimal('statement_balance', 14, 2).notNullable();
    t.decimal('difference', 14, 2).notNullable();
    t.text('notes');
    t.integer('created_by').references('id').inTable('users').onDelete('SET NULL');
    t.timestamps(true, true);
    t.unique(['bank_id', 'statement_date']);
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('bank_reconciliations');
  await knex.schema.dropTableIfExists('treasury_transfers');
  await knex.schema.alterTable('banks', (t) => t.dropColumns('account_number', 'branch_name', 'opening_balance', 'opening_balance_date', 'is_active'));
};
