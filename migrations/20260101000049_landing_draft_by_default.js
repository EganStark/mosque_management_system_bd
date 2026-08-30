const TABLES = ['events', 'staff_members', 'announcements', 'gallery_images', 'faqs', 'janaza_notices'];

exports.up = async (knex) => {
  for (const table of TABLES) await knex.schema.alterTable(table, (t) => t.string('publication_status').notNullable().defaultTo('draft').alter());
};

exports.down = async (knex) => {
  for (const table of TABLES) await knex.schema.alterTable(table, (t) => t.string('publication_status').notNullable().defaultTo('published').alter());
};
