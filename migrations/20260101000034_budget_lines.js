exports.up = async (knex) => {
  await knex.schema.createTable('budget_lines', (t) => {
    t.increments('id').primary();
    t.integer('management_target_id').notNullable().references('id').inTable('management_targets').onDelete('CASCADE');
    t.string('line_type').notNullable();
    t.integer('collection_category_id').references('id').inTable('collection_categories').onDelete('CASCADE');
    t.integer('expense_head_id').references('id').inTable('expense_heads').onDelete('CASCADE');
    t.decimal('budget_amount', 14, 2).notNullable().defaultTo(0);
    t.text('notes');
    t.integer('updated_by').references('id').inTable('users').onDelete('SET NULL');
    t.timestamps(true, true);
    t.index(['management_target_id', 'line_type']);
  });
  await knex.raw("ALTER TABLE budget_lines ADD CONSTRAINT budget_line_kind_check CHECK ((line_type='income' AND collection_category_id IS NOT NULL AND expense_head_id IS NULL) OR (line_type='expense' AND expense_head_id IS NOT NULL AND collection_category_id IS NULL))");
  await knex.raw("CREATE UNIQUE INDEX budget_income_line_unique ON budget_lines(management_target_id, collection_category_id) WHERE line_type='income'");
  await knex.raw("CREATE UNIQUE INDEX budget_expense_line_unique ON budget_lines(management_target_id, expense_head_id) WHERE line_type='expense'");
};

exports.down = async (knex) => knex.schema.dropTableIfExists('budget_lines');
