exports.up = async (knex) => {
  await knex.schema.alterTable("bank_transactions", (table) => {
    table.string("status").notNullable().defaultTo("posted");
    table.timestamp("cancelled_at");
    table.integer("cancelled_by").references("id").inTable("users").onDelete("SET NULL");
    table.text("cancellation_reason");
    table.index(["bank_id", "status", "date"]);
  });
};

exports.down = async (knex) => {
  await knex.schema.alterTable("bank_transactions", (table) => {
    table.dropIndex(["bank_id", "status", "date"]);
    table.dropColumns("status", "cancelled_at", "cancelled_by", "cancellation_reason");
  });
};
