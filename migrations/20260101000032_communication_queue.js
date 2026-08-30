exports.up = async (knex) => {
  await knex.schema.alterTable('communications', (t) => {
    t.timestamp('scheduled_for'); t.timestamp('next_attempt_at'); t.integer('max_attempts').notNullable().defaultTo(3);
    t.decimal('unit_cost', 10, 4).notNullable().defaultTo(0); t.string('cost_currency').notNullable().defaultTo('BDT');
    t.string('delivery_status'); t.timestamp('delivered_at'); t.string('source_type'); t.bigInteger('source_id');
    t.index(['status','scheduled_for']); t.index(['source_type','source_id']);
  });
  await knex.schema.createTable('communication_attempts', (t) => {
    t.bigIncrements('id').primary(); t.bigInteger('communication_id').notNullable().references('id').inTable('communications').onDelete('CASCADE');
    t.integer('attempt_no').notNullable(); t.timestamp('attempted_at').notNullable().defaultTo(knex.fn.now()); t.string('status').notNullable();
    t.string('provider_message_id'); t.text('provider_response'); t.text('error_message'); t.decimal('cost',10,4).notNullable().defaultTo(0);
    t.unique(['communication_id','attempt_no']);
  });
  await knex('communication_templates').insert([
    { name:'দান অঙ্গীকার স্মরণিকা',channel:'sms',body:'আসসালামু আলাইকুম {{name}}, আপনার দান অঙ্গীকারের বকেয়া ৳{{outstanding}}। অনুগ্রহ করে মসজিদ অফিসে যোগাযোগ করুন।' },
    { name:'ঋণ কিস্তি স্মরণিকা',channel:'sms',body:'আসসালামু আলাইকুম {{name}}, আপনার সুদমুক্ত ঋণের বর্তমান বকেয়া ৳{{outstanding}}। অনুগ্রহ করে নির্ধারিত কিস্তি পরিশোধ করুন।' },
  ]);
};
exports.down = async (knex) => { await knex('communication_templates').whereIn('name',['দান অঙ্গীকার স্মরণিকা','ঋণ কিস্তি স্মরণিকা']).del(); await knex.schema.dropTableIfExists('communication_attempts'); await knex.schema.alterTable('communications',t=>{t.dropIndex(['status','scheduled_for']);t.dropIndex(['source_type','source_id']);t.dropColumns('scheduled_for','next_attempt_at','max_attempts','unit_cost','cost_currency','delivery_status','delivered_at','source_type','source_id');}); };
