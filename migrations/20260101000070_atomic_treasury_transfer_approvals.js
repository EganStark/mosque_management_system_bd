exports.up = async (knex) => {
  await knex.schema.alterTable('treasury_transfers', (table) => {
    table.bigInteger('transfer_request_id').unique().references('id').inTable('treasury_transfer_requests').onDelete('SET NULL');
  });
};

exports.down = async (knex) => knex.schema.alterTable('treasury_transfers', (table) => table.dropColumn('transfer_request_id'));
