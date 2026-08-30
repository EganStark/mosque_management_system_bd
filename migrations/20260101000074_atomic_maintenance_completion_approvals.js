exports.up = async (knex) => {
  await knex.schema.alterTable('maintenance_work_orders', (table) => {
    table.bigInteger('completion_request_id').unique().references('id').inTable('maintenance_completion_requests').onDelete('SET NULL');
  });
};
exports.down = async (knex) => knex.schema.alterTable('maintenance_work_orders', (table) => table.dropColumn('completion_request_id'));
