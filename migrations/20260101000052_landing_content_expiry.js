const TABLES = ['events', 'staff_members', 'announcements', 'gallery_images', 'faqs', 'janaza_notices'];
exports.up = async (knex) => { for (const table of TABLES) await knex.schema.alterTable(table, (t) => { t.timestamp('expires_at'); t.index(['publication_status', 'expires_at']); }); };
exports.down = async (knex) => { for (const table of [...TABLES].reverse()) await knex.schema.alterTable(table, (t) => { t.dropIndex(['publication_status', 'expires_at']); t.dropColumn('expires_at'); }); };
