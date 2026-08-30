exports.up = async (knex) => {
  await knex.raw('CREATE UNIQUE INDEX purchase_payment_request_payment_unique ON purchase_payment_requests(purchase_payment_id) WHERE purchase_payment_id IS NOT NULL');
};
exports.down = async (knex) => knex.raw('DROP INDEX IF EXISTS purchase_payment_request_payment_unique');
