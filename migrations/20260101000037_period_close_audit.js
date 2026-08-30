exports.up = async (knex) => {
  await knex.raw('CREATE SEQUENCE accounting_close_reference_seq START 1');
  await knex.schema.createTable('accounting_period_events', (t) => {
    t.bigIncrements('id').primary();
    t.integer('accounting_period_id').notNullable().references('id').inTable('accounting_periods').onDelete('CASCADE');
    t.string('reference_no').notNullable().unique();
    t.string('event_type').notNullable();
    t.jsonb('snapshot');
    t.string('checksum', 64);
    t.text('notes');
    t.text('override_reason');
    t.integer('acted_by').references('id').inTable('users').onDelete('SET NULL');
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    t.index(['accounting_period_id', 'created_at']);
  });
};
exports.down = async (knex) => { await knex.schema.dropTableIfExists('accounting_period_events'); await knex.raw('DROP SEQUENCE IF EXISTS accounting_close_reference_seq'); };
