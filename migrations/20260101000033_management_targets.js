exports.up = async (knex) => {
  await knex.schema.createTable('management_targets', (t) => {
    t.increments('id').primary();
    t.date('target_month').notNullable().unique();
    t.decimal('collection_target', 14, 2).notNullable().defaultTo(0);
    t.decimal('expense_budget', 14, 2).notNullable().defaultTo(0);
    t.text('notes');
    t.integer('updated_by').references('id').inTable('users').onDelete('SET NULL');
    t.timestamps(true, true);
  });
};

exports.down = async (knex) => knex.schema.dropTableIfExists('management_targets');
