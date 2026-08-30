exports.up = async (knex) => {
  await knex.schema.createTable('accounting_periods', (t) => {
    t.increments('id').primary();
    t.date('period_month').notNullable().unique();
    t.string('status').notNullable().defaultTo('open');
    t.text('closing_notes');
    t.integer('closed_by').references('id').inTable('users').onDelete('SET NULL');
    t.timestamp('closed_at');
    t.integer('reopened_by').references('id').inTable('users').onDelete('SET NULL');
    t.timestamp('reopened_at');
    t.text('reopen_reason');
    t.timestamps(true, true);
  });
};
exports.down = async (knex) => knex.schema.dropTableIfExists('accounting_periods');
