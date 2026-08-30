exports.up = async (knex) => {
  await knex('role_permissions').insert([
    { role: 'admin', permission: 'website.publish', allowed: true },
    { role: 'collector', permission: 'website.publish', allowed: false },
    { role: 'viewer', permission: 'website.publish', allowed: false },
  ]).onConflict(['role', 'permission']).ignore();
};

exports.down = async (knex) => {
  await knex('role_permissions').where({ permission: 'website.publish' }).del();
};
