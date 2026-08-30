exports.up = async (knex) => {
  await knex.schema.createTable('treasury_transfer_requests', (table) => {
    table.bigIncrements('id').primary(); table.string('type').notNullable();
    table.integer('from_bank_id').references('id').inTable('banks').onDelete('SET NULL'); table.integer('to_bank_id').references('id').inTable('banks').onDelete('SET NULL');
    table.integer('from_mobile_wallet_id').references('id').inTable('mobile_wallets').onDelete('SET NULL'); table.integer('to_mobile_wallet_id').references('id').inTable('mobile_wallets').onDelete('SET NULL');
    table.decimal('amount', 14, 2).notNullable(); table.date('date').notNullable(); table.string('reference'); table.text('remarks');
    table.string('status').notNullable().defaultTo('pending'); table.integer('requested_by').references('id').inTable('users').onDelete('SET NULL'); table.timestamp('requested_at').notNullable().defaultTo(knex.fn.now());
    table.integer('decided_by').references('id').inTable('users').onDelete('SET NULL'); table.timestamp('decided_at'); table.text('decision_notes');
    table.bigInteger('transfer_id').references('id').inTable('treasury_transfers').onDelete('SET NULL');
    table.index(['status', 'requested_at']); table.index(['from_bank_id', 'status']); table.index(['from_mobile_wallet_id', 'status']);
  });
};
exports.down = async (knex) => knex.schema.dropTableIfExists('treasury_transfer_requests');
