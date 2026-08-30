exports.up = async (knex) => {
  await knex.schema.alterTable("loan_repayments", (table) => {
    table.string("status").notNullable().defaultTo("posted");
    table.timestamp("cancelled_at");
    table.integer("cancelled_by").references("id").inTable("users").onDelete("SET NULL");
    table.text("cancellation_reason");
    table.index(["loan_id", "status"]);
  });
};

exports.down = async (knex) => {
  await knex.schema.alterTable("loan_repayments", (table) => {
    table.dropIndex(["loan_id", "status"]);
    table.dropColumns("status", "cancelled_at", "cancelled_by", "cancellation_reason");
  });
};
