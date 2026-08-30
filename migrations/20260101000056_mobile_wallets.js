exports.up = async (knex) => {
  await knex.schema.createTable("mobile_wallets", (t) => {
    t.increments("id").primary();
    t.string("provider").notNullable();
    t.string("name").notNullable();
    t.string("account_number");
    t.decimal("opening_balance", 14, 2).notNullable().defaultTo(0);
    t.date("opening_balance_date");
    t.boolean("is_active").notNullable().defaultTo(true);
    t.timestamps(true, true);
    t.unique(["provider", "name"]);
  });
  await knex.schema.alterTable("collections", (t) => {
    t.integer("mobile_wallet_id")
      .references("id")
      .inTable("mobile_wallets")
      .onDelete("SET NULL");
    t.index(["payment_method", "mobile_wallet_id"]);
  });
  await knex.schema.alterTable("expenses", (t) => {
    t.integer("mobile_wallet_id")
      .references("id")
      .inTable("mobile_wallets")
      .onDelete("SET NULL");
    t.index(["payment_method", "mobile_wallet_id"]);
  });
  await knex("mobile_wallets").insert([
    { provider: "bkash", name: "Mosque bKash" },
    { provider: "nagad", name: "Mosque Nagad" },
    { provider: "rocket", name: "Mosque Rocket" },
  ]);
};

exports.down = async (knex) => {
  await knex.schema.alterTable("expenses", (t) => {
    t.dropIndex(["payment_method", "mobile_wallet_id"]);
    t.dropColumn("mobile_wallet_id");
  });
  await knex.schema.alterTable("collections", (t) => {
    t.dropIndex(["payment_method", "mobile_wallet_id"]);
    t.dropColumn("mobile_wallet_id");
  });
  await knex.schema.dropTableIfExists("mobile_wallets");
};
