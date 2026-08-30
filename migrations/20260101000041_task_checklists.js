exports.up = async (knex) => {
  await knex.schema.createTable('mosque_task_checklist_items', (t) => {
    t.bigIncrements('id').primary();
    t.bigInteger('task_id').notNullable().references('id').inTable('mosque_tasks').onDelete('CASCADE');
    t.string('title').notNullable();
    t.integer('sort_order').notNullable().defaultTo(0);
    t.boolean('is_completed').notNullable().defaultTo(false);
    t.integer('created_by').references('id').inTable('users').onDelete('SET NULL');
    t.integer('completed_by').references('id').inTable('users').onDelete('SET NULL');
    t.timestamp('completed_at');
    t.timestamps(true, true);
    t.index(['task_id', 'sort_order']);
  });
};
exports.down = async (knex) => knex.schema.dropTableIfExists('mosque_task_checklist_items');
