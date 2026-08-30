exports.up = async (knex) => {
  await knex.schema.alterTable('communications', (t) => {
    t.uuid('batch_id');
    t.integer('approved_by').references('id').inTable('users').onDelete('SET NULL');
    t.timestamp('approved_at');
    t.integer('send_attempts').notNullable().defaultTo(0);
    t.string('provider_message_id');
    t.text('last_error');
    t.index(['batch_id']);
  });
};

exports.down = async (knex) => {
  await knex.schema.alterTable('communications', (t) => {
    t.dropIndex(['batch_id']);
    t.dropColumns('batch_id', 'approved_by', 'approved_at', 'send_attempts', 'provider_message_id', 'last_error');
  });
};
