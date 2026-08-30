exports.up = async (knex) => {
  await knex.schema.alterTable("mosque_loans", (table) => {
    table.timestamp("cancelled_at");
    table.integer("cancelled_by").references("id").inTable("users").onDelete("SET NULL");
    table.text("cancellation_reason");
  });
};

exports.down = async (knex) => {
  await knex.schema.alterTable("mosque_loans", (table) => {
    table.dropColumns("cancelled_at", "cancelled_by", "cancellation_reason");
  });
};
