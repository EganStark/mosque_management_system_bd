exports.up = async (knex) => {
  await knex.schema.createTable('welfare_disbursement_requests', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('application_id').notNullable().references('id').inTable('welfare_applications').onDelete('RESTRICT');
    table.decimal('amount', 14, 2).notNullable();
    table.date('disbursement_date').notNullable();
    table.string('payment_method').notNullable();
    table.integer('bank_id').references('id').inTable('banks').onDelete('SET NULL');
    table.integer('mobile_wallet_id').references('id').inTable('mobile_wallets').onDelete('SET NULL');
    table.string('reference');
    table.text('remarks');
    table.string('status').notNullable().defaultTo('pending');
    table.integer('requested_by').references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('requested_at').notNullable().defaultTo(knex.fn.now());
    table.integer('decided_by').references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('decided_at');
    table.text('decision_notes');
    table.index(['application_id', 'status']);
    table.index(['status', 'requested_at']);
  });
};

exports.down = (knex) => knex.schema.dropTableIfExists('welfare_disbursement_requests');
