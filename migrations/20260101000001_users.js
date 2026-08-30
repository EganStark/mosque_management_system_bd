exports.up = async (knex) => {
  await knex.schema.createTable('users', (t) => {
    t.increments('id').primary();
    t.string('name').notNullable();
    t.string('username').notNullable().unique();
    t.string('email');
    t.string('password_hash').notNullable();
    t.enu('role', ['admin', 'collector', 'viewer'], {
      useNative: true,
      enumName: 'user_role',
    }).notNullable().defaultTo('viewer');
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamps(true, true);
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('users');
  await knex.raw('DROP TYPE IF EXISTS user_role');
};
