exports.up = async (knex) => {
  await knex.schema.createTable('mosque_programs', (t) => {
    t.increments('id').primary();
    t.string('name').notNullable();
    t.string('category').notNullable().defaultTo('education');
    t.text('description');
    t.string('instructor_name');
    t.string('venue');
    t.string('schedule_text');
    t.date('start_date');
    t.date('end_date');
    t.integer('capacity');
    t.string('status').notNullable().defaultTo('active');
    t.integer('created_by').references('id').inTable('users').onDelete('SET NULL');
    t.timestamps(true, true);
  });
  await knex.schema.createTable('program_enrollments', (t) => {
    t.increments('id').primary();
    t.integer('program_id').notNullable().references('id').inTable('mosque_programs').onDelete('CASCADE');
    t.integer('member_id').references('id').inTable('members').onDelete('SET NULL');
    t.string('participant_name').notNullable();
    t.string('phone');
    t.string('guardian_name');
    t.string('guardian_phone');
    t.date('enrolled_at').notNullable().defaultTo(knex.fn.now());
    t.string('status').notNullable().defaultTo('active');
    t.text('notes');
    t.timestamps(true, true);
    t.unique(['program_id', 'member_id']);
    t.index(['program_id', 'status']);
  });
  await knex.schema.createTable('program_attendance', (t) => {
    t.bigIncrements('id').primary();
    t.integer('program_id').notNullable().references('id').inTable('mosque_programs').onDelete('CASCADE');
    t.integer('enrollment_id').notNullable().references('id').inTable('program_enrollments').onDelete('CASCADE');
    t.date('attendance_date').notNullable();
    t.string('status').notNullable().defaultTo('present');
    t.text('remarks');
    t.integer('recorded_by').references('id').inTable('users').onDelete('SET NULL');
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    t.unique(['enrollment_id', 'attendance_date']);
    t.index(['program_id', 'attendance_date']);
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('program_attendance');
  await knex.schema.dropTableIfExists('program_enrollments');
  await knex.schema.dropTableIfExists('mosque_programs');
};
