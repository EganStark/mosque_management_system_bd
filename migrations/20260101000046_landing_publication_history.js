exports.up = async (knex) => {
  await knex.schema.createTable('landing_publication_events', (t) => {
    t.bigIncrements('id').primary();
    t.string('content_type').notNullable();
    t.integer('content_id').notNullable();
    t.string('content_title').notNullable();
    t.string('previous_status');
    t.string('new_status').notNullable();
    t.integer('acted_by').references('id').inTable('users').onDelete('SET NULL');
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    t.index(['content_type', 'content_id', 'created_at']);
    t.index(['created_at']);
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('landing_publication_events');
};
