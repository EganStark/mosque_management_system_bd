exports.up = async (knex) => {
  await knex.raw('CREATE SEQUENCE IF NOT EXISTS mosque_loan_no_seq START 1');
  await knex.schema.createTable('mosque_loans', (t) => {
    t.bigIncrements('id').primary();
    t.string('loan_no').notNullable().unique();
    t.integer('member_id').references('id').inTable('members').onDelete('SET NULL');
    t.string('borrower_name').notNullable();
    t.string('phone');
    t.text('address');
    t.text('purpose').notNullable();
    t.decimal('principal_amount', 14, 2).notNullable();
    t.decimal('repaid_amount', 14, 2).notNullable().defaultTo(0);
    t.decimal('installment_amount', 14, 2);
    t.date('issue_date').notNullable();
    t.date('first_due_date');
    t.date('final_due_date');
    t.string('payment_method').notNullable().defaultTo('cash');
    t.integer('bank_id').references('id').inTable('banks').onDelete('RESTRICT');
    t.string('reference');
    t.string('guarantor_name');
    t.string('guarantor_phone');
    t.text('notes');
    t.string('status').notNullable().defaultTo('active');
    t.integer('created_by').references('id').inTable('users').onDelete('SET NULL');
    t.timestamps(true, true);
    t.index(['status', 'final_due_date']);
    t.index(['member_id', 'issue_date']);
  });
  await knex.schema.createTable('loan_repayments', (t) => {
    t.bigIncrements('id').primary();
    t.bigInteger('loan_id').notNullable().references('id').inTable('mosque_loans').onDelete('RESTRICT');
    t.decimal('amount', 14, 2).notNullable();
    t.date('payment_date').notNullable();
    t.string('payment_method').notNullable().defaultTo('cash');
    t.integer('bank_id').references('id').inTable('banks').onDelete('RESTRICT');
    t.string('reference');
    t.text('remarks');
    t.integer('received_by').references('id').inTable('users').onDelete('SET NULL');
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    t.index(['loan_id', 'payment_date']);
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('loan_repayments');
  await knex.schema.dropTableIfExists('mosque_loans');
  await knex.raw('DROP SEQUENCE IF EXISTS mosque_loan_no_seq');
};
