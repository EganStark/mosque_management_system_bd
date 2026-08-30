exports.up = async (knex) => {
  await knex.raw('CREATE UNIQUE INDEX payroll_payment_request_payment_unique ON staff_payroll_payment_requests(payroll_payment_id) WHERE payroll_payment_id IS NOT NULL');
};
exports.down = async (knex) => knex.raw('DROP INDEX IF EXISTS payroll_payment_request_payment_unique');
