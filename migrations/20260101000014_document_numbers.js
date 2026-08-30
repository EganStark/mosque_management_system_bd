exports.up = async (knex) => {
  await knex.raw('CREATE SEQUENCE IF NOT EXISTS collection_receipt_seq START 1');
  await knex.raw('CREATE SEQUENCE IF NOT EXISTS expense_voucher_seq START 1');
  await knex.schema.alterTable('collections', (t) => t.index(['receipt_no']));
  await knex.schema.alterTable('expenses', (t) => t.index(['voucher_no']));
};

exports.down = async (knex) => {
  await knex.schema.alterTable('expenses', (t) => t.dropIndex(['voucher_no']));
  await knex.schema.alterTable('collections', (t) => t.dropIndex(['receipt_no']));
  await knex.raw('DROP SEQUENCE IF EXISTS expense_voucher_seq');
  await knex.raw('DROP SEQUENCE IF EXISTS collection_receipt_seq');
};
