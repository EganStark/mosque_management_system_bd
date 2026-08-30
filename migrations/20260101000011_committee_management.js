exports.up = async (knex) => {
  await knex.schema.alterTable('staff_members', (t) => {
    t.integer('member_id').references('id').inTable('members').onDelete('SET NULL');
    t.string('staff_type').notNullable().defaultTo('staff');
    t.date('joining_date');
    t.date('leaving_date');
    t.decimal('monthly_allowance', 14, 2).notNullable().defaultTo(0);
    t.text('address');
    t.boolean('show_on_website').notNullable().defaultTo(true);
  });

  await knex.schema.createTable('committee_types', (t) => {
    t.increments('id').primary();
    t.string('name').notNullable().unique();
    t.text('description');
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamps(true, true);
  });

  await knex.schema.createTable('committees', (t) => {
    t.increments('id').primary();
    t.string('name').notNullable();
    t.date('start_date').notNullable();
    t.date('end_date');
    t.string('status').notNullable().defaultTo('active');
    t.text('notes');
    t.timestamps(true, true);
  });

  await knex.schema.createTable('committee_members', (t) => {
    t.increments('id').primary();
    t.integer('committee_id').notNullable().references('id').inTable('committees').onDelete('CASCADE');
    t.integer('member_id').notNullable().references('id').inTable('members').onDelete('RESTRICT');
    t.integer('committee_type_id').notNullable().references('id').inTable('committee_types').onDelete('RESTRICT');
    t.integer('sort_order').notNullable().defaultTo(0);
    t.date('appointed_at');
    t.date('ended_at');
    t.string('status').notNullable().defaultTo('active');
    t.text('notes');
    t.timestamps(true, true);
    t.unique(['committee_id', 'member_id']);
  });

  await knex('committee_types').insert([
    { name: 'সভাপতি' }, { name: 'সহ-সভাপতি' }, { name: 'সাধারণ সম্পাদক' },
    { name: 'যুগ্ম সম্পাদক' }, { name: 'কোষাধ্যক্ষ' }, { name: 'সদস্য' },
  ]);
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('committee_members');
  await knex.schema.dropTableIfExists('committees');
  await knex.schema.dropTableIfExists('committee_types');
  await knex.schema.alterTable('staff_members', (t) => {
    t.dropColumns('member_id', 'staff_type', 'joining_date', 'leaving_date', 'monthly_allowance', 'address', 'show_on_website');
  });
};
