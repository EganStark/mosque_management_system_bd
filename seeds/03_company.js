exports.seed = async (knex) => {
  const existing = await knex('company_settings').first();
  if (existing) return;
  await knex('company_settings').insert({
    company_name: 'Noor Community Mosque',
    company_address: '',
    company_phone: '',
    company_email: '',
  });
  console.log('Seeded default company settings.');
};
