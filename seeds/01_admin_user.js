const bcrypt = require('bcryptjs');

exports.seed = async (knex) => {
  const username = process.env.ADMIN_USERNAME || 'admin';
  const existing = await knex('users').whereRaw('LOWER(username) = LOWER(?)', [username]).first();
  if (existing) {
    console.log(`Admin user "${username}" already exists — skipping.`);
    return;
  }
  const password = process.env.ADMIN_PASSWORD || 'ChangeMe@123';
  const password_hash = await bcrypt.hash(password, 10);
  await knex('users').insert({
    name: process.env.ADMIN_NAME || 'Administrator',
    username,
    email: process.env.ADMIN_EMAIL || 'admin@example.com',
    password_hash,
    role: 'admin',
    is_active: true,
  });
  console.log(`Seeded admin user "${username}".`);
};
