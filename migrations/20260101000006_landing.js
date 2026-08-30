exports.up = async (knex) => {
  // 1. prayer_settings
  await knex.schema.createTable('prayer_settings', (t) => {
    t.increments('id').primary();
    t.string('fajr').notNullable().defaultTo('04:30');
    t.string('dhuhr').notNullable().defaultTo('12:15');
    t.string('asr').notNullable().defaultTo('15:45');
    t.string('maghrib').notNullable().defaultTo('18:25');
    t.string('isha').notNullable().defaultTo('19:55');
    t.string('jummah').notNullable().defaultTo('13:15');
    t.string('hijri_date').notNullable().defaultTo('17 Dhul-Hijjah 1447');
    t.string('venue_name').notNullable().defaultTo('নূর কমিউনিটি মসজিদ');
    t.string('venue_address').notNullable().defaultTo('ঢাকা, বাংলাদেশ');
    t.string('venue_phone').notNullable().defaultTo('+880 1234-567890');
    t.timestamps(true, true);
  });

  // 2. events
  await knex.schema.createTable('events', (t) => {
    t.increments('id').primary();
    t.string('title_bn').notNullable();
    t.string('title_en').notNullable();
    t.text('description_bn');
    t.text('description_en');
    t.string('category').notNullable().defaultTo('general');
    t.date('event_date').notNullable();
    t.string('event_time').notNullable();
    t.string('location').notNullable();
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamps(true, true);
  });

  // 3. staff_members
  await knex.schema.createTable('staff_members', (t) => {
    t.increments('id').primary();
    t.string('name_bn').notNullable();
    t.string('name_en').notNullable();
    t.string('position_bn').notNullable();
    t.string('position_en').notNullable();
    t.text('bio_bn');
    t.text('bio_en');
    t.string('email');
    t.string('phone');
    t.string('photo');
    t.integer('sort_order').notNullable().defaultTo(0);
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamps(true, true);
  });

  // 4. announcements
  await knex.schema.createTable('announcements', (t) => {
    t.increments('id').primary();
    t.string('title_bn').notNullable();
    t.string('title_en').notNullable();
    t.text('content_bn');
    t.text('content_en');
    t.string('category').notNullable().defaultTo('general'); // general/emergency/event/meeting
    t.boolean('is_active').notNullable().defaultTo(true);
    t.date('publish_date').notNullable();
    t.timestamps(true, true);
  });

  // 5. gallery_images
  await knex.schema.createTable('gallery_images', (t) => {
    t.increments('id').primary();
    t.string('title_bn').notNullable();
    t.string('title_en').notNullable();
    t.string('image_path').notNullable();
    t.string('category').notNullable().defaultTo('mosque');
    t.integer('sort_order').notNullable().defaultTo(0);
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamps(true, true);
  });

  // 6. faqs
  await knex.schema.createTable('faqs', (t) => {
    t.increments('id').primary();
    t.text('question_bn').notNullable();
    t.text('question_en').notNullable();
    t.text('answer_bn').notNullable();
    t.text('answer_en').notNullable();
    t.integer('sort_order').notNullable().defaultTo(0);
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamps(true, true);
  });

  // 7. janaza_notices
  await knex.schema.createTable('janaza_notices', (t) => {
    t.increments('id').primary();
    t.string('deceased_name_bn').notNullable();
    t.string('deceased_name_en').notNullable();
    t.date('janaza_date').notNullable();
    t.string('janaza_time').notNullable();
    t.string('location_bn').notNullable();
    t.string('location_en').notNullable();
    t.text('message_bn');
    t.text('message_en');
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamps(true, true);
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('janaza_notices');
  await knex.schema.dropTableIfExists('faqs');
  await knex.schema.dropTableIfExists('gallery_images');
  await knex.schema.dropTableIfExists('announcements');
  await knex.schema.dropTableIfExists('staff_members');
  await knex.schema.dropTableIfExists('events');
  await knex.schema.dropTableIfExists('prayer_settings');
};
