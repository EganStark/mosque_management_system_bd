exports.config = { transaction: false };

exports.up = async (knex) => {
  await knex.raw("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'demo'");
};

// PostgreSQL enum values cannot be removed safely while dependent rows or
// defaults may exist. Rolling back leaves the inert value available.
exports.down = async () => {};
