const bcrypt = require('bcryptjs');

exports.seed = async (knex) => {
  if (String(process.env.DEMO_MODE || '').toLowerCase() !== 'true') return;

  const username = String(process.env.DEMO_USERNAME || '').trim();
  const password = String(process.env.DEMO_PASSWORD || '');
  if (!username || !password) throw new Error('DEMO_USERNAME and DEMO_PASSWORD are required when DEMO_MODE=true');

  const existing = await knex('users').whereRaw('LOWER(username) = LOWER(?)', [username]).first();
  if (existing) {
    await knex('users').where({ id: existing.id }).update({
      name: process.env.DEMO_NAME || 'Demo Administrator',
      email: process.env.DEMO_EMAIL || 'demo@example.invalid',
      role: 'demo',
      is_active: true,
      updated_at: knex.fn.now(),
    });
    console.log(`Demo user "${username}" already exists — access restored without changing its password.`);
    return;
  }

  await knex('users').insert({
    name: process.env.DEMO_NAME || 'Demo Administrator',
    username,
    email: process.env.DEMO_EMAIL || 'demo@example.invalid',
    password_hash: await bcrypt.hash(password, 10),
    role: 'demo',
    is_active: true,
  });
  console.log(`Seeded read-only demo user "${username}".`);
};
