exports.up = (knex) => knex.schema.alterTable('events', (t) => {
  t.string('recurrence_type').notNullable().defaultTo('none');
  t.date('recurrence_until');
});

exports.down = (knex) => knex.schema.alterTable('events', (t) => {
  t.dropColumn('recurrence_until');
  t.dropColumn('recurrence_type');
});
