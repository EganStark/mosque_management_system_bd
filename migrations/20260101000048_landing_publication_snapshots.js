exports.up = async (knex) => {
  await knex.schema.alterTable('landing_publication_events', (t) => {
    t.jsonb('snapshot');
    t.string('action').notNullable().defaultTo('status_change');
  });
};

exports.down = async (knex) => {
  await knex.schema.alterTable('landing_publication_events', (t) => {
    t.dropColumn('action');
    t.dropColumn('snapshot');
  });
};
