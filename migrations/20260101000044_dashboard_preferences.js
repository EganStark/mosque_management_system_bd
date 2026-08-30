exports.up = async (knex) => {
  await knex.schema.createTable('user_dashboard_preferences', (t) => {
    t.bigIncrements('id').primary();
    t.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE').unique();
    t.jsonb('hidden_widgets').notNullable().defaultTo('[]');
    t.integer('updated_by').references('id').inTable('users').onDelete('SET NULL');
    t.timestamps(true, true);
  });
};
exports.down = async (knex) => knex.schema.dropTableIfExists('user_dashboard_preferences');
