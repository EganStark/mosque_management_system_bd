const PAYMENT_TABLES = [
  "facility_booking_payments",
  "staff_payroll_payments",
  "welfare_disbursements",
  "purchase_payments",
];

exports.up = async (knex) => {
  for (const table of PAYMENT_TABLES) {
    await knex.schema.alterTable(table, (t) => {
      t.string("status").notNullable().defaultTo("posted");
      t.index("status");
    });
  }
};

exports.down = async (knex) => {
  for (const table of [...PAYMENT_TABLES].reverse()) {
    await knex.schema.alterTable(table, (t) => {
      t.dropIndex("status");
      t.dropColumn("status");
    });
  }
};
