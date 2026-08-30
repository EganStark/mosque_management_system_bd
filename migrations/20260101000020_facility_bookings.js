exports.up = async (knex) => {
  await knex.raw('CREATE SEQUENCE facility_booking_no_seq START 1');
  await knex.schema.createTable('facilities', (t) => {
    t.increments('id').primary();
    t.string('name').notNullable().unique();
    t.string('location');
    t.integer('capacity');
    t.decimal('default_fee', 14, 2).notNullable().defaultTo(0);
    t.text('description');
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamps(true, true);
  });
  await knex.schema.createTable('facility_bookings', (t) => {
    t.bigIncrements('id').primary();
    t.integer('facility_id').notNullable().references('id').inTable('facilities').onDelete('RESTRICT');
    t.integer('member_id').references('id').inTable('members').onDelete('SET NULL');
    t.string('booking_no').notNullable().unique();
    t.string('requester_name').notNullable();
    t.string('requester_phone').notNullable();
    t.string('booking_type').notNullable();
    t.string('event_title').notNullable();
    t.date('booking_date').notNullable();
    t.time('start_time').notNullable();
    t.time('end_time').notNullable();
    t.integer('expected_guests');
    t.decimal('fee_amount', 14, 2).notNullable().defaultTo(0);
    t.decimal('amount_paid', 14, 2).notNullable().defaultTo(0);
    t.string('payment_status').notNullable().defaultTo('unpaid');
    t.string('status').notNullable().defaultTo('pending');
    t.text('requirements');
    t.text('notes');
    t.integer('created_by').references('id').inTable('users').onDelete('SET NULL');
    t.integer('approved_by').references('id').inTable('users').onDelete('SET NULL');
    t.timestamp('approved_at');
    t.timestamps(true, true);
    t.index(['facility_id', 'booking_date']);
    t.index(['status', 'booking_date']);
  });
  await knex.schema.createTable('facility_booking_payments', (t) => {
    t.bigIncrements('id').primary();
    t.bigInteger('booking_id').notNullable().references('id').inTable('facility_bookings').onDelete('CASCADE');
    t.decimal('amount', 14, 2).notNullable();
    t.date('payment_date').notNullable();
    t.string('payment_method').notNullable().defaultTo('cash');
    t.string('reference');
    t.text('remarks');
    t.integer('received_by').references('id').inTable('users').onDelete('SET NULL');
    t.integer('collection_id').references('id').inTable('collections').onDelete('SET NULL');
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
  });
  await knex('collection_categories').insert({ name: 'সুবিধা বুকিং ফি', code: 'facility-booking' }).onConflict('code').ignore();
  await knex('facilities').insert([
    { name: 'মসজিদ মিলনায়তন', location: 'নিচতলা', capacity: 200, default_fee: 0, description: 'বিবাহ, আকীকা ও সামাজিক আয়োজন' },
    { name: 'শিক্ষা কক্ষ', location: 'দ্বিতীয় তলা', capacity: 40, default_fee: 0, description: 'ক্লাস, প্রশিক্ষণ ও সভা' },
    { name: 'খাবার বিতরণ এলাকা', location: 'মসজিদ প্রাঙ্গণ', capacity: 100, default_fee: 0, description: 'ইফতার ও খাবার বিতরণ' },
  ]);
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('facility_booking_payments');
  await knex.schema.dropTableIfExists('facility_bookings');
  await knex.schema.dropTableIfExists('facilities');
  await knex('collection_categories').where({ code: 'facility-booking' }).del();
  await knex.raw('DROP SEQUENCE IF EXISTS facility_booking_no_seq');
};
