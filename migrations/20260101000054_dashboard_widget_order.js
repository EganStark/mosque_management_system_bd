exports.up = (knex) => knex.schema.alterTable('user_dashboard_preferences', (t) => {
  t.jsonb('widget_order').notNullable().defaultTo('["welcome","controls","performance","schedule","stats"]');
});

exports.down = (knex) => knex.schema.alterTable('user_dashboard_preferences', (t) => {
  t.dropColumn('widget_order');
});
