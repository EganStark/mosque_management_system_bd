const TABLES = ['events', 'staff_members', 'announcements', 'gallery_images', 'faqs', 'janaza_notices'];

exports.up = async (knex) => {
  for (const table of TABLES) await knex.schema.alterTable(table, (t) => {
    t.string('review_status').notNullable().defaultTo('draft');
    t.timestamp('review_requested_at');
    t.integer('review_requested_by').references('id').inTable('users').onDelete('SET NULL');
    t.timestamp('reviewed_at');
    t.integer('reviewed_by').references('id').inTable('users').onDelete('SET NULL');
    t.text('review_notes');
    t.index(['review_status', 'review_requested_at']);
  });
};

exports.down = async (knex) => {
  for (const table of [...TABLES].reverse()) await knex.schema.alterTable(table, (t) => {
    t.dropIndex(['review_status', 'review_requested_at']);
    t.dropColumn('review_notes'); t.dropColumn('reviewed_by'); t.dropColumn('reviewed_at'); t.dropColumn('review_requested_by'); t.dropColumn('review_requested_at'); t.dropColumn('review_status');
  });
};
