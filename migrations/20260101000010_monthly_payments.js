exports.up = async (knex) => {
  await knex.schema.createTable('monthly_bills', (t) => {
    t.increments('id').primary();
    t.integer('member_id').notNullable().references('id').inTable('members').onDelete('CASCADE');
    t.date('billing_month').notNullable();
    t.decimal('amount_due', 14, 2).notNullable().defaultTo(0);
    t.decimal('amount_paid', 14, 2).notNullable().defaultTo(0);
    t.string('status').notNullable().defaultTo('unpaid');
    t.timestamp('generated_at').notNullable().defaultTo(knex.fn.now());
    t.integer('generated_by').references('id').inTable('users').onDelete('SET NULL');
    t.timestamps(true, true);
    t.unique(['member_id', 'billing_month']);
    t.index(['billing_month', 'status']);
  });

  await knex.schema.createTable('monthly_payments', (t) => {
    t.increments('id').primary();
    t.integer('monthly_bill_id').notNullable().references('id').inTable('monthly_bills').onDelete('CASCADE');
    t.integer('collection_id').notNullable().references('id').inTable('collections').onDelete('RESTRICT');
    t.decimal('amount', 14, 2).notNullable();
    t.date('payment_date').notNullable();
    t.string('status').notNullable().defaultTo('posted');
    t.timestamps(true, true);
    t.unique(['collection_id']);
    t.index(['monthly_bill_id', 'status']);
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('monthly_payments');
  await knex.schema.dropTableIfExists('monthly_bills');
};
