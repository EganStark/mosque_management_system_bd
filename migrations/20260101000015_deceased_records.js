exports.up = async (knex) => {
  await knex.schema.createTable('deceased_records', (t) => {
    t.increments('id').primary();
    t.integer('member_id').notNullable().unique().references('id').inTable('members').onDelete('RESTRICT');
    t.date('death_date').notNullable();
    t.string('death_place');
    t.text('death_cause');
    t.date('janaza_date');
    t.string('janaza_time');
    t.string('janaza_location');
    t.date('burial_date');
    t.string('burial_location');
    t.string('contact_person');
    t.string('contact_phone');
    t.text('notes');
    t.integer('created_by').references('id').inTable('users').onDelete('SET NULL');
    t.timestamps(true, true);
    t.index(['death_date']);
  });
  await knex.schema.alterTable('janaza_notices', (t) => {
    t.integer('deceased_record_id').unique().references('id').inTable('deceased_records').onDelete('SET NULL');
  });
};

exports.down = async (knex) => {
  await knex.schema.alterTable('janaza_notices', (t) => t.dropColumn('deceased_record_id'));
  await knex.schema.dropTableIfExists('deceased_records');
};
