exports.up = async (knex) => {
  await knex.schema.createTable('user_pinned_items', t => { t.bigIncrements('id').primary(); t.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE'); t.string('item_type').notNullable(); t.string('title').notNullable(); t.string('subtitle'); t.string('icon').notNullable().defaultTo('bookmark'); t.string('href').notNullable(); t.timestamps(true, true); t.unique(['user_id', 'href']); });
  await knex.schema.createTable('user_search_history', t => { t.bigIncrements('id').primary(); t.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE'); t.string('query').notNullable(); t.integer('result_count').notNullable().defaultTo(0); t.timestamp('searched_at').notNullable().defaultTo(knex.fn.now()); t.unique(['user_id', 'query']); });
};
exports.down = async knex => { await knex.schema.dropTableIfExists('user_search_history'); await knex.schema.dropTableIfExists('user_pinned_items'); };
