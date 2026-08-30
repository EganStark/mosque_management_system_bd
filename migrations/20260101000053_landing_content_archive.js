const TABLES = ['events', 'staff_members', 'announcements', 'gallery_images', 'faqs', 'janaza_notices'];

exports.up = async function up(knex) {
  for (const table of TABLES) {
    await knex.schema.alterTable(table, (t) => {
      t.timestamp('deleted_at');
      t.integer('deleted_by').references('id').inTable('users').onDelete('SET NULL');
      t.index(['deleted_at']);
    });
  }
};

exports.down = async function down(knex) {
  for (const table of [...TABLES].reverse()) {
    await knex.schema.alterTable(table, (t) => {
      t.dropIndex(['deleted_at']);
      t.dropColumn('deleted_by');
      t.dropColumn('deleted_at');
    });
  }
};
