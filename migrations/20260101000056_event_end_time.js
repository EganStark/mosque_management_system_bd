exports.up = (knex) => knex.schema.alterTable('events', (t) => { t.string('end_time'); });
exports.down = (knex) => knex.schema.alterTable('events', (t) => { t.dropColumn('end_time'); });
