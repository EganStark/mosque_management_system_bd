exports.up = async (knex) => {
  await knex.schema.createTable('members', (t) => {
    t.increments('id').primary();
    t.string('id_no').notNullable().unique();
    t.string('name').notNullable();
    t.string('phone');
    t.string('other_phones');
    t.integer('occupation_id').references('id').inTable('occupations').onDelete('SET NULL');
    t.string('occupation_section');
    t.enu('gender', ['male', 'female'], { useNative: true, enumName: 'member_gender' }).defaultTo('male');
    t.string('photo');

    // Address (cascading)
    t.integer('division_id').references('id').inTable('divisions').onDelete('SET NULL');
    t.integer('district_id').references('id').inTable('districts').onDelete('SET NULL');
    t.integer('thana_id').references('id').inTable('thanas').onDelete('SET NULL');
    t.integer('post_office_id').references('id').inTable('post_offices').onDelete('SET NULL');
    t.integer('village_id').references('id').inTable('villages').onDelete('SET NULL');
    t.integer('area_id').references('id').inTable('areas').onDelete('SET NULL');
    t.string('post_code');
    t.text('address_text');

    // Spouse
    t.string('wife_name');
    t.date('wife_die_date');
    t.string('husband_name');
    t.date('husband_die_date');
    t.string('spouse_photo');

    // Parents
    t.string('father_name');
    t.date('father_birth_date');
    t.date('father_die_date');
    t.string('father_photo');
    t.string('mother_name');
    t.date('mother_birth_date');
    t.date('mother_die_date');
    t.string('mother_photo');

    // Grandparents
    t.string('grandfather_name');
    t.date('grandfather_die_date');
    t.string('grandmother_name');
    t.date('grandmother_die_date');

    // Donor meta
    t.integer('reference_member_id').references('id').inTable('members').onDelete('SET NULL');
    t.enu('status', ['active', 'deactive'], { useNative: true, enumName: 'member_status' }).defaultTo('active');
    t.date('birth_date');
    t.date('die_date');
    t.boolean('monthly_payment').defaultTo(false);
    t.decimal('monthly_payment_amount', 12, 2).defaultTo(0);

    t.timestamps(true, true);
  });

  await knex.schema.createTable('member_children', (t) => {
    t.increments('id').primary();
    t.integer('member_id').references('id').inTable('members').onDelete('CASCADE');
    t.enu('type', ['son', 'daughter'], { useNative: true, enumName: 'child_type' }).notNullable();
    t.string('sl');
    t.string('name').notNullable();
    t.date('birth_date');
    t.date('die_date');
    t.string('photo');
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('member_children');
  await knex.schema.dropTableIfExists('members');
  await knex.raw('DROP TYPE IF EXISTS member_gender');
  await knex.raw('DROP TYPE IF EXISTS member_status');
  await knex.raw('DROP TYPE IF EXISTS child_type');
};
