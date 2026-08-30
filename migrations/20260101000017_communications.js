exports.up = async (knex) => {
  await knex.schema.createTable('communication_templates', (t) => {
    t.increments('id').primary();
    t.string('name').notNullable();
    t.string('channel').notNullable().defaultTo('sms');
    t.string('subject');
    t.text('body').notNullable();
    t.boolean('is_active').notNullable().defaultTo(true);
    t.integer('created_by').references('id').inTable('users').onDelete('SET NULL');
    t.timestamps(true, true);
  });
  await knex.schema.createTable('communications', (t) => {
    t.bigIncrements('id').primary();
    t.integer('template_id').references('id').inTable('communication_templates').onDelete('SET NULL');
    t.integer('member_id').references('id').inTable('members').onDelete('SET NULL');
    t.integer('monthly_bill_id').references('id').inTable('monthly_bills').onDelete('SET NULL');
    t.string('channel').notNullable();
    t.string('recipient_name').notNullable();
    t.string('recipient_address');
    t.string('subject');
    t.text('body').notNullable();
    t.string('status').notNullable().defaultTo('draft');
    t.text('provider_response');
    t.timestamp('sent_at');
    t.integer('created_by').references('id').inTable('users').onDelete('SET NULL');
    t.timestamps(true, true);
    t.index(['channel', 'status']);
    t.index(['member_id', 'created_at']);
  });
  await knex('communication_templates').insert([
    { name: 'মাসিক চাঁদা স্মরণিকা', channel: 'sms', body: 'আসসালামু আলাইকুম {{name}}, {{month}} মাসের বকেয়া চাঁদা ৳{{outstanding}}। অনুগ্রহ করে মসজিদ অফিসে পরিশোধ করুন।' },
    { name: 'বকেয়া চাঁদার চিঠি', channel: 'letter', subject: 'মাসিক চাঁদা পরিশোধের অনুরোধ', body: 'সম্মানিত {{name}},\n\nআপনার {{month}} মাসের বকেয়া চাঁদার পরিমাণ ৳{{outstanding}}। মসজিদের নিয়মিত কার্যক্রম সচল রাখতে অনুগ্রহ করে সুবিধাজনক সময়ে পরিশোধ করুন।\n\nজাযাকাল্লাহু খাইরান।' },
    { name: 'সাধারণ ঘোষণা', channel: 'sms', body: 'আসসালামু আলাইকুম {{name}}, মসজিদের পক্ষ থেকে জানানো যাচ্ছে: {{message}}' },
  ]);
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('communications');
  await knex.schema.dropTableIfExists('communication_templates');
};
