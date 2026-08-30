exports.up = async (knex) => {
  await knex.schema.createTable('mosque_task_templates', (t) => {
    t.bigIncrements('id').primary(); t.string('name').notNullable(); t.text('description');
    t.string('category').notNullable().defaultTo('general'); t.string('priority').notNullable().defaultTo('normal');
    t.integer('default_assigned_user_id').references('id').inTable('users').onDelete('SET NULL');
    t.integer('default_duration_days').notNullable().defaultTo(1); t.boolean('is_active').notNullable().defaultTo(true);
    t.integer('created_by').references('id').inTable('users').onDelete('SET NULL'); t.timestamps(true, true);
    t.index(['is_active', 'category']);
  });
  await knex.schema.createTable('mosque_task_template_items', (t) => {
    t.bigIncrements('id').primary(); t.bigInteger('template_id').notNullable().references('id').inTable('mosque_task_templates').onDelete('CASCADE');
    t.string('title').notNullable(); t.integer('sort_order').notNullable().defaultTo(0); t.timestamps(true, true);
    t.index(['template_id', 'sort_order']);
  });
};
exports.down = async (knex) => { await knex.schema.dropTableIfExists('mosque_task_template_items'); await knex.schema.dropTableIfExists('mosque_task_templates'); };
