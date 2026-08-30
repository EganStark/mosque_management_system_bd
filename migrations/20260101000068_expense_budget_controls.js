exports.up = async (knex) => {
  await knex.schema.alterTable('expenses', (table) => {
    table.decimal('budget_amount_at_approval', 14, 2);
    table.decimal('budget_spent_before', 14, 2);
    table.text('budget_override_reason');
  });
};
exports.down = async (knex) => knex.schema.alterTable('expenses', (table) => table.dropColumns('budget_amount_at_approval', 'budget_spent_before', 'budget_override_reason'));
