exports.up = async (knex) => {
  await knex.schema.alterTable("mosque_loans", (table) => {
    table
      .integer("mobile_wallet_id")
      .references("id")
      .inTable("mobile_wallets")
      .onDelete("RESTRICT");
    table.index(["mobile_wallet_id", "issue_date"]);
  });
  await knex.schema.alterTable("loan_repayments", (table) => {
    table
      .integer("mobile_wallet_id")
      .references("id")
      .inTable("mobile_wallets")
      .onDelete("RESTRICT");
    table.index(["mobile_wallet_id", "payment_date"]);
  });
};

exports.down = async (knex) => {
  await knex.schema.alterTable("loan_repayments", (table) => {
    table.dropIndex(["mobile_wallet_id", "payment_date"]);
    table.dropColumn("mobile_wallet_id");
  });
  await knex.schema.alterTable("mosque_loans", (table) => {
    table.dropIndex(["mobile_wallet_id", "issue_date"]);
    table.dropColumn("mobile_wallet_id");
  });
};
