exports.up = async (knex) => {
  await knex.schema.alterTable('mosque_tasks', (t) => {
    t.string('recurrence_type').notNullable().defaultTo('none');
    t.integer('recurrence_interval').notNullable().defaultTo(1);
    t.date('recurrence_end_date');
    t.bigInteger('parent_task_id').references('id').inTable('mosque_tasks').onDelete('SET NULL');
    t.index(['recurrence_type', 'due_date']);
  });
};
exports.down = async (knex) => {
  await knex.schema.alterTable('mosque_tasks', (t) => {
    t.dropIndex(['recurrence_type', 'due_date']);
    t.dropColumn('parent_task_id'); t.dropColumn('recurrence_end_date'); t.dropColumn('recurrence_interval'); t.dropColumn('recurrence_type');
  });
};
