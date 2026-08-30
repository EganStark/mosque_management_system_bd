exports.up = async (knex) => {
  await knex.schema.alterTable("treasury_transfers", (table) => {
    table.integer("from_mobile_wallet_id").references("id").inTable("mobile_wallets").onDelete("RESTRICT");
    table.integer("to_mobile_wallet_id").references("id").inTable("mobile_wallets").onDelete("RESTRICT");
    table.index(["from_mobile_wallet_id", "date"]);
    table.index(["to_mobile_wallet_id", "date"]);
  });
};

exports.down = async (knex) => {
  await knex.schema.alterTable("treasury_transfers", (table) => {
    table.dropIndex(["from_mobile_wallet_id", "date"]);
    table.dropIndex(["to_mobile_wallet_id", "date"]);
    table.dropColumns("from_mobile_wallet_id", "to_mobile_wallet_id");
  });
};
