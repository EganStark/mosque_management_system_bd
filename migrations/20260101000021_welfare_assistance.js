exports.up = async (knex) => {
  await knex.raw('CREATE SEQUENCE welfare_application_no_seq START 1');
  await knex.schema.createTable('welfare_beneficiaries', (t) => {
    t.bigIncrements('id').primary();
    t.integer('member_id').references('id').inTable('members').onDelete('SET NULL');
    t.string('name').notNullable();
    t.string('phone');
    t.text('address');
    t.integer('household_size');
    t.decimal('monthly_income', 14, 2);
    t.string('identity_reference');
    t.string('eligibility_status').notNullable().defaultTo('pending');
    t.text('verification_notes');
    t.integer('verified_by').references('id').inTable('users').onDelete('SET NULL');
    t.timestamp('verified_at');
    t.integer('created_by').references('id').inTable('users').onDelete('SET NULL');
    t.timestamps(true, true);
  });
  await knex.schema.createTable('welfare_applications', (t) => {
    t.bigIncrements('id').primary();
    t.bigInteger('beneficiary_id').notNullable().references('id').inTable('welfare_beneficiaries').onDelete('RESTRICT');
    t.string('application_no').notNullable().unique();
    t.string('assistance_type').notNullable();
    t.string('fund_source').notNullable().defaultTo('general');
    t.text('reason').notNullable();
    t.decimal('requested_amount', 14, 2).notNullable().defaultTo(0);
    t.decimal('approved_amount', 14, 2).notNullable().defaultTo(0);
    t.decimal('disbursed_amount', 14, 2).notNullable().defaultTo(0);
    t.string('urgency').notNullable().defaultTo('normal');
    t.string('status').notNullable().defaultTo('pending');
    t.text('decision_notes');
    t.integer('approved_by').references('id').inTable('users').onDelete('SET NULL');
    t.timestamp('approved_at');
    t.integer('created_by').references('id').inTable('users').onDelete('SET NULL');
    t.timestamps(true, true);
    t.index(['status', 'urgency']);
    t.index(['beneficiary_id', 'created_at']);
  });
  await knex.schema.createTable('welfare_disbursements', (t) => {
    t.bigIncrements('id').primary();
    t.bigInteger('application_id').notNullable().references('id').inTable('welfare_applications').onDelete('RESTRICT');
    t.integer('expense_id').references('id').inTable('expenses').onDelete('SET NULL');
    t.decimal('amount', 14, 2).notNullable();
    t.date('disbursement_date').notNullable();
    t.string('payment_method').notNullable().defaultTo('cash');
    t.string('reference');
    t.text('remarks');
    t.integer('disbursed_by').references('id').inTable('users').onDelete('SET NULL');
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
  });
  if (!await knex('expense_heads').where({ name: 'কল্যাণ ও সহায়তা' }).first()) await knex('expense_heads').insert({ name: 'কল্যাণ ও সহায়তা' });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('welfare_disbursements');
  await knex.schema.dropTableIfExists('welfare_applications');
  await knex.schema.dropTableIfExists('welfare_beneficiaries');
  await knex('expense_heads').where({ name: 'কল্যাণ ও সহায়তা' }).del();
  await knex.raw('DROP SEQUENCE IF EXISTS welfare_application_no_seq');
};
