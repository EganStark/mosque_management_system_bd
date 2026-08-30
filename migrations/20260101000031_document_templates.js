exports.up = async (knex) => {
  await knex.schema.alterTable('document_records', (t) => {
    t.string('template_key');
    t.string('source_type');
    t.bigInteger('source_id');
    t.string('signatory_name');
    t.string('signatory_title');
    t.string('secondary_signatory_name');
    t.string('secondary_signatory_title');
    t.jsonb('source_snapshot');
    t.index(['source_type', 'source_id']);
  });
};
exports.down = async (knex) => { await knex.schema.alterTable('document_records', (t) => { t.dropIndex(['source_type','source_id']); t.dropColumns('template_key','source_type','source_id','signatory_name','signatory_title','secondary_signatory_name','secondary_signatory_title','source_snapshot'); }); };
