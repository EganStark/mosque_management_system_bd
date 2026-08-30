exports.up = async (knex) => {
  await knex.schema.createTable('staff_payroll_payment_requests', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('payroll_id').notNullable().references('id').inTable('staff_payrolls').onDelete('RESTRICT');
    table.decimal('amount', 14, 2).notNullable(); table.date('payment_date').notNullable();
    table.string('payment_method').notNullable();
    table.integer('bank_id').references('id').inTable('banks').onDelete('SET NULL');
    table.integer('mobile_wallet_id').references('id').inTable('mobile_wallets').onDelete('SET NULL');
    table.string('reference'); table.text('remarks'); table.string('status').notNullable().defaultTo('pending');
    table.integer('requested_by').references('id').inTable('users').onDelete('SET NULL'); table.timestamp('requested_at').notNullable().defaultTo(knex.fn.now());
    table.integer('decided_by').references('id').inTable('users').onDelete('SET NULL'); table.timestamp('decided_at'); table.text('decision_notes');
    table.bigInteger('payroll_payment_id').references('id').inTable('staff_payroll_payments').onDelete('SET NULL');
    table.index(['payroll_id', 'status']); table.index(['status', 'requested_at']);
  });
};
exports.down = async (knex) => knex.schema.dropTableIfExists('staff_payroll_payment_requests');
