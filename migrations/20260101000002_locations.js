exports.up = async (knex) => {
  await knex.schema.createTable('occupations', (t) => {
    t.increments('id').primary();
    t.string('name').notNullable();
  });

  await knex.schema.createTable('divisions', (t) => {
    t.increments('id').primary();
    t.string('name').notNullable();
  });

  await knex.schema.createTable('districts', (t) => {
    t.increments('id').primary();
    t.integer('division_id').references('id').inTable('divisions').onDelete('CASCADE');
    t.string('name').notNullable();
  });

  await knex.schema.createTable('thanas', (t) => {
    t.increments('id').primary();
    t.integer('district_id').references('id').inTable('districts').onDelete('CASCADE');
    t.string('name').notNullable();
  });

  await knex.schema.createTable('post_offices', (t) => {
    t.increments('id').primary();
    t.integer('thana_id').references('id').inTable('thanas').onDelete('CASCADE');
    t.string('name').notNullable();
    t.string('post_code');
  });

  await knex.schema.createTable('villages', (t) => {
    t.increments('id').primary();
    t.integer('post_office_id').references('id').inTable('post_offices').onDelete('CASCADE');
    t.string('name').notNullable();
  });

  await knex.schema.createTable('areas', (t) => {
    t.increments('id').primary();
    t.integer('village_id').references('id').inTable('villages').onDelete('CASCADE');
    t.string('name').notNullable();
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('areas');
  await knex.schema.dropTableIfExists('villages');
  await knex.schema.dropTableIfExists('post_offices');
  await knex.schema.dropTableIfExists('thanas');
  await knex.schema.dropTableIfExists('districts');
  await knex.schema.dropTableIfExists('divisions');
  await knex.schema.dropTableIfExists('occupations');
};
