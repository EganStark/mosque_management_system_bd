exports.up = async (knex) => {
  await knex.schema.createTable('collection_categories', (t) => {
    t.increments('id').primary();
    t.string('name').notNullable().unique();
    t.string('code').notNullable().unique();
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamps(true, true);
  });

  await knex('collection_categories').insert([
    { name: 'মাসিক চাঁদা', code: 'monthly' },
    { name: 'সাধারণ দান', code: 'general-donation' },
    { name: 'মসজিদ নির্মাণ', code: 'construction' },
    { name: 'জাকাত', code: 'zakat' },
    { name: 'সদকা', code: 'sadaqah' },
    { name: 'বিশেষ তহবিল', code: 'special-fund' },
    { name: 'অন্যান্য', code: 'other' },
  ]);

  await knex.schema.alterTable('collections', (t) => {
    t.integer('collection_category_id').references('id').inTable('collection_categories').onDelete('SET NULL');
    t.string('payer_name');
    t.string('payment_method').notNullable().defaultTo('cash');
    t.integer('bank_id').references('id').inTable('banks').onDelete('SET NULL');
    t.string('transaction_reference');
    t.string('status').notNullable().defaultTo('posted');
    t.timestamp('cancelled_at');
    t.integer('cancelled_by').references('id').inTable('users').onDelete('SET NULL');
    t.text('cancellation_reason');
  });

  await knex.schema.alterTable('expenses', (t) => {
    t.string('voucher_no');
    t.string('payee');
    t.string('payment_method').notNullable().defaultTo('cash');
    t.integer('bank_id').references('id').inTable('banks').onDelete('SET NULL');
    t.string('transaction_reference');
    t.text('remarks');
    t.string('status').notNullable().defaultTo('posted');
    t.timestamp('cancelled_at');
    t.integer('cancelled_by').references('id').inTable('users').onDelete('SET NULL');
    t.text('cancellation_reason');
  });

  await knex.schema.alterTable('collections', (t) => {
    t.index(['date', 'status']);
    t.index(['collection_category_id', 'date']);
  });
  await knex.schema.alterTable('expenses', (t) => {
    t.index(['date', 'status']);
    t.index(['expense_head_id', 'date']);
  });
};

exports.down = async (knex) => {
  await knex.schema.alterTable('expenses', (t) => {
    t.dropIndex(['expense_head_id', 'date']);
    t.dropIndex(['date', 'status']);
    t.dropColumns('voucher_no', 'payee', 'payment_method', 'bank_id', 'transaction_reference', 'remarks', 'status', 'cancelled_at', 'cancelled_by', 'cancellation_reason');
  });
  await knex.schema.alterTable('collections', (t) => {
    t.dropIndex(['collection_category_id', 'date']);
    t.dropIndex(['date', 'status']);
    t.dropColumns('collection_category_id', 'payer_name', 'payment_method', 'bank_id', 'transaction_reference', 'status', 'cancelled_at', 'cancelled_by', 'cancellation_reason');
  });
  await knex.schema.dropTableIfExists('collection_categories');
};
