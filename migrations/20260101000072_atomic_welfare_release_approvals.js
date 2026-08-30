exports.up = async (knex) => {
  await knex.schema.alterTable('welfare_disbursement_requests', (table) => {
    table.bigInteger('disbursement_id').unique().references('id').inTable('welfare_disbursements').onDelete('SET NULL');
  });
};
exports.down = async (knex) => knex.schema.alterTable('welfare_disbursement_requests', (table) => table.dropColumn('disbursement_id'));
