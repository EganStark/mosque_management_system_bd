const PERMISSIONS = ['members.manage', 'finance.manage', 'monthly.manage', 'people.manage', 'assets.manage', 'deceased.manage', 'website.manage', 'reports.view', 'system.manage'];

exports.up = async (knex) => {
  await knex.schema.createTable('role_permissions', (t) => {
    t.increments('id').primary();
    t.string('role').notNullable();
    t.string('permission').notNullable();
    t.boolean('allowed').notNullable().defaultTo(false);
    t.timestamps(true, true);
    t.unique(['role', 'permission']);
  });
  await knex.schema.createTable('audit_logs', (t) => {
    t.bigIncrements('id').primary();
    t.integer('user_id').references('id').inTable('users').onDelete('SET NULL');
    t.string('username');
    t.string('role');
    t.string('method').notNullable();
    t.string('path').notNullable();
    t.string('action').notNullable();
    t.string('entity');
    t.string('entity_id');
    t.integer('status_code');
    t.string('ip_address');
    t.text('user_agent');
    t.jsonb('changes');
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    t.index(['user_id', 'created_at']);
    t.index(['entity', 'created_at']);
    t.index(['action', 'created_at']);
  });
  const rows = [];
  for (const role of ['admin', 'collector', 'viewer']) {
    for (const permission of PERMISSIONS) {
      const allowed = role === 'admin' || (role === 'collector' && ['members.manage', 'finance.manage', 'monthly.manage', 'reports.view'].includes(permission)) || (role === 'viewer' && permission === 'reports.view');
      rows.push({ role, permission, allowed });
    }
  }
  await knex('role_permissions').insert(rows);
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('audit_logs');
  await knex.schema.dropTableIfExists('role_permissions');
};
