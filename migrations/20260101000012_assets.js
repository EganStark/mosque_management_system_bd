exports.up = async (knex) => {
  await knex.schema.createTable('asset_categories', (t) => {
    t.increments('id').primary();
    t.string('name').notNullable().unique();
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamps(true, true);
  });
  await knex.schema.createTable('assets', (t) => {
    t.increments('id').primary();
    t.string('asset_code').notNullable().unique();
    t.string('name').notNullable();
    t.integer('category_id').references('id').inTable('asset_categories').onDelete('SET NULL');
    t.text('description');
    t.decimal('quantity', 12, 2).notNullable().defaultTo(1);
    t.string('unit').notNullable().defaultTo('টি');
    t.date('purchase_date');
    t.decimal('purchase_price', 14, 2).notNullable().defaultTo(0);
    t.string('supplier');
    t.string('invoice_number');
    t.date('warranty_until');
    t.string('location');
    t.integer('responsible_member_id').references('id').inTable('members').onDelete('SET NULL');
    t.string('condition').notNullable().defaultTo('good');
    t.string('status').notNullable().defaultTo('active');
    t.date('disposed_at');
    t.text('disposal_reason');
    t.text('notes');
    t.integer('created_by').references('id').inTable('users').onDelete('SET NULL');
    t.timestamps(true, true);
    t.index(['status', 'category_id']);
  });
  await knex.schema.createTable('asset_maintenance', (t) => {
    t.increments('id').primary();
    t.integer('asset_id').notNullable().references('id').inTable('assets').onDelete('CASCADE');
    t.date('maintenance_date').notNullable();
    t.string('maintenance_type').notNullable().defaultTo('service');
    t.text('description').notNullable();
    t.string('service_provider');
    t.decimal('cost', 14, 2).notNullable().defaultTo(0);
    t.date('next_maintenance_date');
    t.integer('created_by').references('id').inTable('users').onDelete('SET NULL');
    t.timestamps(true, true);
    t.index(['asset_id', 'maintenance_date']);
  });
  await knex('asset_categories').insert([
    { name: 'সাউন্ড সিস্টেম' }, { name: 'বৈদ্যুতিক সরঞ্জাম' }, { name: 'আসবাবপত্র' },
    { name: 'শীতাতপ নিয়ন্ত্রণ' }, { name: 'কার্পেট ও সাজসজ্জা' }, { name: 'পানি ও স্যানিটেশন' },
    { name: 'জেনারেটর ও বিদ্যুৎ' }, { name: 'অন্যান্য' },
  ]);
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('asset_maintenance');
  await knex.schema.dropTableIfExists('assets');
  await knex.schema.dropTableIfExists('asset_categories');
};
