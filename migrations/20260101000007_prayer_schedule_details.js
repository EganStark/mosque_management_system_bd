exports.up = async function (knex) {
  await knex.schema.alterTable('prayer_settings', (t) => {
    t.string('sahri_end').notNullable().defaultTo('04:20');
    t.string('iftar_time').notNullable().defaultTo('18:25');
    t.string('sunrise').notNullable().defaultTo('05:48');
    t.string('fajr_end').notNullable().defaultTo('05:45');
    t.string('dhuhr_start').notNullable().defaultTo('12:05');
    t.string('dhuhr_end').notNullable().defaultTo('15:40');
    t.string('asr_end').notNullable().defaultTo('18:20');
    t.string('maghrib_end').notNullable().defaultTo('19:50');
    t.string('isha_end').notNullable().defaultTo('04:15');
    t.string('sunrise_forbidden_end').notNullable().defaultTo('06:08');
    t.string('zawal_start').notNullable().defaultTo('11:55');
    t.string('zawal_end').notNullable().defaultTo('12:05');
    t.string('sunset_forbidden_start').notNullable().defaultTo('18:15');
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('prayer_settings', (t) => {
    t.dropColumns(
      'sahri_end',
      'iftar_time',
      'sunrise',
      'fajr_end',
      'dhuhr_start',
      'dhuhr_end',
      'asr_end',
      'maghrib_end',
      'isha_end',
      'sunrise_forbidden_end',
      'zawal_start',
      'zawal_end',
      'sunset_forbidden_start',
    );
  });
};
