exports.up = async (knex) => {
  await knex.schema.createTable('maintenance_completion_requests', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('work_order_id').notNullable().references('id').inTable('maintenance_work_orders').onDelete('RESTRICT');
    table.date('completed_date').notNullable();
    table.decimal('actual_cost', 14, 2).notNullable().defaultTo(0);
    table.date('next_maintenance_date');
    table.text('completion_notes');
    table.string('payee');
    table.string('payment_method').notNullable().defaultTo('cash');
    table.integer('bank_id').references('id').inTable('banks').onDelete('SET NULL');
    table.integer('mobile_wallet_id').references('id').inTable('mobile_wallets').onDelete('SET NULL');
    table.string('reference');
    table.string('status').notNullable().defaultTo('pending');
    table.integer('requested_by').references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('requested_at').notNullable().defaultTo(knex.fn.now());
    table.integer('decided_by').references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('decided_at');
    table.text('decision_notes');
    table.index(['work_order_id', 'status']);
    table.index(['status', 'requested_at']);
  });
};

exports.down = async (knex) => knex.schema.dropTableIfExists('maintenance_completion_requests');
