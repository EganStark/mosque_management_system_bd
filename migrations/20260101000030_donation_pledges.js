exports.up = async (knex) => {
  await knex.raw('CREATE SEQUENCE IF NOT EXISTS donation_pledge_no_seq START 1');
  await knex.schema.createTable('donation_pledges', (t) => {
    t.bigIncrements('id').primary();
    t.string('pledge_no').notNullable().unique();
    t.integer('member_id').references('id').inTable('members').onDelete('SET NULL');
    t.string('donor_name').notNullable();
    t.string('phone');
    t.integer('collection_category_id').references('id').inTable('collection_categories').onDelete('SET NULL');
    t.text('purpose').notNullable();
    t.decimal('pledged_amount', 14, 2).notNullable();
    t.decimal('paid_amount', 14, 2).notNullable().defaultTo(0);
    t.date('pledge_date').notNullable();
    t.date('due_date');
    t.string('follow_up_status').notNullable().defaultTo('not_contacted');
    t.date('last_contact_date');
    t.date('next_follow_up_date');
    t.text('follow_up_notes');
    t.string('status').notNullable().defaultTo('active');
    t.integer('created_by').references('id').inTable('users').onDelete('SET NULL');
    t.timestamps(true, true);
    t.index(['status', 'due_date']);
    t.index(['next_follow_up_date', 'follow_up_status']);
  });
  await knex.schema.createTable('pledge_payments', (t) => {
    t.bigIncrements('id').primary();
    t.bigInteger('pledge_id').notNullable().references('id').inTable('donation_pledges').onDelete('RESTRICT');
    t.integer('collection_id').notNullable().unique().references('id').inTable('collections').onDelete('RESTRICT');
    t.decimal('amount', 14, 2).notNullable();
    t.date('payment_date').notNullable();
    t.string('status').notNullable().defaultTo('posted');
    t.integer('received_by').references('id').inTable('users').onDelete('SET NULL');
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
  });
};
exports.down = async (knex) => { await knex.schema.dropTableIfExists('pledge_payments'); await knex.schema.dropTableIfExists('donation_pledges'); await knex.raw('DROP SEQUENCE IF EXISTS donation_pledge_no_seq'); };
