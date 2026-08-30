exports.up = async (knex) => {
  await knex.schema.createTable('company_settings', (t) => {
    t.increments('id').primary();
    t.string('company_name').notNullable().defaultTo('Noor Community Mosque');
    t.text('company_address');
    t.string('company_phone');
    t.string('company_email');
    t.string('logo');
    t.timestamps(true, true);
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('company_settings');
};
