exports.up = async function (knex) {
  await knex.schema.alterTable('prayer_settings', (t) => {
    t.string('fajr_start').notNullable().defaultTo('04:10');
    t.string('asr_start').notNullable().defaultTo('15:30');
    t.string('maghrib_start').notNullable().defaultTo('18:25');
    t.string('isha_start').notNullable().defaultTo('19:45');
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('prayer_settings', (t) => {
    t.dropColumns('fajr_start', 'asr_start', 'maghrib_start', 'isha_start');
  });
};
