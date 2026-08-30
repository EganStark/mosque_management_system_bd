exports.up = async (knex) => {
  await knex.schema.alterTable('expenses', (table) => {
    table.integer('submitted_by').references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('submitted_at');
    table.integer('approved_by').references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('approved_at');
    table.integer('rejected_by').references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('rejected_at');
    table.text('decision_notes');
    table.index(['status', 'submitted_at']);
  });
};

exports.down = async (knex) => {
  await knex.schema.alterTable('expenses', (table) => {
    table.dropIndex(['status', 'submitted_at']);
    table.dropColumns('submitted_by', 'submitted_at', 'approved_by', 'approved_at', 'rejected_by', 'rejected_at', 'decision_notes');
  });
};
