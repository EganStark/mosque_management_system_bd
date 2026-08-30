exports.up = async (knex) => {
  await knex.schema.createTable('banks', (t) => {
    t.increments('id').primary();
    t.string('name').notNullable();
  });

  await knex.schema.createTable('bank_transactions', (t) => {
    t.increments('id').primary();
    t.integer('bank_id').references('id').inTable('banks').onDelete('CASCADE');
    t.enu('type', ['deposit', 'withdraw'], { useNative: true, enumName: 'bank_txn_type' }).notNullable();
    t.decimal('amount', 14, 2).notNullable().defaultTo(0);
    t.string('cheque_number');
    t.string('payment_method');
    t.text('remarks');
    t.date('date').notNullable();
    t.integer('created_by').references('id').inTable('users').onDelete('SET NULL');
    t.timestamps(true, true);
  });

  await knex.schema.createTable('expense_heads', (t) => {
    t.increments('id').primary();
    t.string('name').notNullable();
    t.string('voucher_no');
  });

  await knex.schema.createTable('expenses', (t) => {
    t.increments('id').primary();
    t.integer('expense_head_id').references('id').inTable('expense_heads').onDelete('SET NULL');
    t.text('purpose');
    t.decimal('unit', 12, 2);
    t.decimal('rate', 12, 2);
    t.decimal('amount', 14, 2).notNullable().defaultTo(0);
    t.date('date').notNullable();
    t.integer('created_by').references('id').inTable('users').onDelete('SET NULL');
    t.timestamps(true, true);
  });

  await knex.schema.createTable('book_types', (t) => {
    t.increments('id').primary();
    t.string('name').notNullable();
    t.boolean('monthly_book').defaultTo(false);
  });

  await knex.schema.createTable('book_numbers', (t) => {
    t.increments('id').primary();
    t.integer('book_type_id').references('id').inTable('book_types').onDelete('SET NULL');
    t.string('book_number').notNullable();
    t.string('receipt_from');
    t.string('receipt_to');
    t.integer('collector_id').references('id').inTable('users').onDelete('SET NULL');
    t.date('issue_date');
    t.enu('status', ['active', 'deactive'], { useNative: true, enumName: 'book_status' }).defaultTo('active');
    t.date('active_date');
    t.date('deactive_date');
  });

  await knex.schema.createTable('collections', (t) => {
    t.increments('id').primary();
    t.integer('member_id').references('id').inTable('members').onDelete('SET NULL');
    t.text('purpose');
    t.string('account');
    t.integer('book_number_id').references('id').inTable('book_numbers').onDelete('SET NULL');
    t.string('receipt_no');
    t.text('remarks');
    t.decimal('amount', 14, 2).notNullable().defaultTo(0);
    t.date('date').notNullable();
    t.integer('created_by').references('id').inTable('users').onDelete('SET NULL');
    t.timestamps(true, true);
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('collections');
  await knex.schema.dropTableIfExists('book_numbers');
  await knex.schema.dropTableIfExists('book_types');
  await knex.schema.dropTableIfExists('expenses');
  await knex.schema.dropTableIfExists('expense_heads');
  await knex.schema.dropTableIfExists('bank_transactions');
  await knex.schema.dropTableIfExists('banks');
  await knex.raw('DROP TYPE IF EXISTS bank_txn_type');
  await knex.raw('DROP TYPE IF EXISTS book_status');
};
