exports.up = async (knex) => {
  await knex.schema.createTable('user_notification_states', (t) => {
    t.bigIncrements('id').primary();
    t.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.string('notification_key').notNullable();
    t.integer('last_seen_count').notNullable().defaultTo(0);
    t.timestamp('read_at').notNullable().defaultTo(knex.fn.now());
    t.timestamps(true, true);
    t.unique(['user_id', 'notification_key']);
  });
};
exports.down = async (knex) => knex.schema.dropTableIfExists('user_notification_states');
