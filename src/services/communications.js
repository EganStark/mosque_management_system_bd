const db = require('../config/db');
const { randomUUID } = require('crypto');
const smsProvider = require('./sms-provider');

function monthValue(value) {
  return /^\d{4}-\d{2}$/.test(String(value || '')) ? `${value}-01` : null;
}

function render(template, values) {
  return String(template || '').replace(/{{\s*(name|month|outstanding|message)\s*}}/g, (_, key) => values[key] == null ? '' : String(values[key]));
}

async function templates() {
  return db('communication_templates').where({ is_active: true }).orderBy('channel').orderBy('name');
}

async function recipients(month) {
  const billingMonth = monthValue(month);
  const query = db('members as m').leftJoin('monthly_bills as mb', function () {
    this.on('mb.member_id', '=', 'm.id');
    if (billingMonth) this.andOn('mb.billing_month', '=', db.raw('?', [billingMonth]));
  }).where('m.status', 'active').whereNull('m.die_date')
    .select('m.id', 'm.id_no', 'm.name', 'm.phone', 'm.address_text', 'mb.id as monthly_bill_id', 'mb.billing_month',
      db.raw('COALESCE(mb.amount_due - mb.amount_paid, 0) as outstanding'))
    .orderBy('m.name');
  return query;
}

async function history() {
  return db('communications as c').leftJoin('members as m', 'c.member_id', 'm.id').leftJoin('users as u', 'c.created_by', 'u.id')
    .select('c.*', 'm.id_no as member_id_no', 'u.name as created_by_name').orderBy('c.id', 'desc').limit(200);
}

async function createDraft(data, userId) {
  const member = await db('members').where({ id: data.member_id }).first();
  if (!member) throw new Error('Member not found');
  const template = await db('communication_templates').where({ id: data.template_id, is_active: true }).first();
  if (!template) throw new Error('Template not found');
  const bill = data.monthly_bill_id ? await db('monthly_bills').where({ id: data.monthly_bill_id, member_id: member.id }).first() : null;
  const values = {
    name: member.name,
    month: data.month || (bill && String(bill.billing_month).slice(0, 7)) || '',
    outstanding: bill ? Number(bill.amount_due) - Number(bill.amount_paid) : (data.outstanding || 0),
    message: data.message || '',
  };
  const [draft] = await db('communications').insert({
    template_id: template.id, member_id: member.id, monthly_bill_id: bill ? bill.id : null,
    channel: template.channel, recipient_name: member.name,
    recipient_address: template.channel === 'sms' ? member.phone : member.address_text,
    subject: render(template.subject, values) || null, body: render(template.body, values), status: 'draft', created_by: userId,
  }).returning('*');
  return draft;
}

async function createBulkDrafts(data, userId) {
  const memberIds = [...new Set((Array.isArray(data.member_ids) ? data.member_ids : [data.member_ids]).map(Number).filter(Number.isInteger))];
  if (!memberIds.length) throw new Error('Select at least one member');
  const template = await db('communication_templates').where({ id: data.template_id, is_active: true }).first();
  if (!template) throw new Error('Template not found');
  const batchId = randomUUID();
  return db.transaction(async (trx) => {
    const members = await trx('members').whereIn('id', memberIds).where({ status: 'active' }).whereNull('die_date');
    if (!members.length) throw new Error('No active members found');
    const billingMonth = monthValue(data.month);
    const bills = billingMonth ? await trx('monthly_bills').whereIn('member_id', members.map((m) => m.id)).where({ billing_month: billingMonth }) : [];
    const billMap = new Map(bills.map((bill) => [Number(bill.member_id), bill]));
    const rows = members.map((member) => {
      const bill = billMap.get(Number(member.id));
      const values = { name: member.name, month: data.month || '', outstanding: bill ? Number(bill.amount_due) - Number(bill.amount_paid) : 0, message: data.message || '' };
      return { template_id: template.id, member_id: member.id, monthly_bill_id: bill ? bill.id : null, batch_id: batchId,
        channel: template.channel, recipient_name: member.name, recipient_address: template.channel === 'sms' ? member.phone : member.address_text,
        subject: render(template.subject, values) || null, body: render(template.body, values), status: 'draft', created_by: userId };
    });
    return trx('communications').insert(rows).returning('*');
  });
}

async function find(id) {
  return db('communications as c').leftJoin('members as m', 'c.member_id', 'm.id')
    .select('c.*', 'm.id_no as member_id_no', 'm.address_text as member_address').where('c.id', id).first();
}

async function updateTemplate(id, data) {
  await db('communication_templates').where({ id }).update({ name: data.name, subject: data.subject || null, body: data.body, updated_at: db.fn.now() });
}

async function approve(id, userId) {
  const item = await db('communications').where({ id }).first();
  if (!item) throw new Error('Communication not found');
  if (item.status !== 'draft') throw new Error('Only drafts can be approved');
  if (!item.recipient_address) throw new Error(item.channel === 'sms' ? 'Member has no mobile number' : 'Member has no address');
  await db('communications').where({ id }).update({ status: 'approved', approved_by: userId, approved_at: db.fn.now(), updated_at: db.fn.now(), last_error: null });
  return find(id);
}

async function sendApproved(id) {
  const item = await db('communications').where({ id }).first();
  if (!item) throw new Error('Communication not found');
  if (item.channel !== 'sms') throw new Error('Only SMS messages use the gateway');
  if (item.status !== 'approved' && item.status !== 'failed') throw new Error('Approve this SMS before sending');
  if (!smsProvider.status().enabled) throw new Error('SMS gateway is not configured; message remains queued');
  if (Number(item.send_attempts) >= Number(item.max_attempts || 3)) throw new Error('Maximum delivery attempts reached');
  const attemptNo = Number(item.send_attempts) + 1;
  try {
    await db('communications').where({ id }).update({ status: 'sending', send_attempts: db.raw('send_attempts + 1'), last_error: null, updated_at: db.fn.now() });
    const result = await smsProvider.send({ to: item.recipient_address, message: item.body });
    const provider = smsProvider.status();
    await db.transaction(async trx=>{await trx('communications').where({ id }).update({ status: 'sent', sent_at: trx.fn.now(), provider_message_id: result.id, provider_response: JSON.stringify(result.response), unit_cost: provider.unitCost, cost_currency: provider.currency, delivery_status:'accepted', next_attempt_at:null, updated_at: trx.fn.now() });await trx('communication_attempts').insert({communication_id:id,attempt_no:attemptNo,status:'accepted',provider_message_id:result.id,provider_response:JSON.stringify(result.response),cost:provider.unitCost});});
  } catch (err) {
    const next = attemptNo < Number(item.max_attempts || 3) ? new Date(Date.now() + Math.min(60, 5 * (2 ** (attemptNo - 1))) * 60000) : null;
    await db.transaction(async trx=>{await trx('communications').where({ id }).update({ status: 'failed', last_error: err.message.slice(0, 1000), next_attempt_at:next, updated_at: trx.fn.now() });await trx('communication_attempts').insert({communication_id:id,attempt_no:attemptNo,status:'failed',error_message:err.message.slice(0,1000)}).onConflict(['communication_id','attempt_no']).ignore();});
    throw err;
  }
  return find(id);
}

async function schedule(id, scheduledFor, userId) {
  const item=await db('communications').where({id}).first();if(!item||item.channel!=='sms')throw new Error('SMS draft not found');
  if(item.status==='draft')await approve(id,userId);else if(!['approved','failed'].includes(item.status))throw new Error('Only approved or failed SMS can be scheduled');
  await db('communications').where({id}).update({status:'approved',scheduled_for:scheduledFor,next_attempt_at:null,last_error:null,updated_at:db.fn.now()});return find(id);
}

async function queue(){return db('communications').whereIn('status',['approved','sending','failed']).orderByRaw('COALESCE(next_attempt_at,scheduled_for,created_at) ASC').limit(300);}
async function attempts(id){return db('communication_attempts').where({communication_id:id}).orderBy('attempt_no','desc');}
async function deliverySummary(){const r=await db('communications').where({channel:'sms'}).first(db.raw("COUNT(*) FILTER(WHERE status='approved')::int queued"),db.raw("COUNT(*) FILTER(WHERE status='failed')::int failed"),db.raw("COUNT(*) FILTER(WHERE status='sent')::int sent"),db.raw("COALESCE(SUM(unit_cost) FILTER(WHERE status='sent'),0) cost"));return{queued:Number(r.queued||0),failed:Number(r.failed||0),sent:Number(r.sent||0),cost:Number(r.cost||0)};}
async function processDue(limit=25){if(!smsProvider.status().enabled)throw new Error('SMS gateway is disabled; queue was not changed');const rows=await db('communications').where({channel:'sms'}).where(q=>q.where(function(){this.where({status:'approved'}).where(q2=>q2.whereNull('scheduled_for').orWhere('scheduled_for','<=',db.fn.now()));}).orWhere(function(){this.where({status:'failed'}).where('send_attempts','<',db.ref('max_attempts')).where('next_attempt_at','<=',db.fn.now());})).orderBy('id').limit(limit);const result={sent:0,failed:0};for(const row of rows){try{await sendApproved(row.id);result.sent++;}catch(_){result.failed++;}}return result;}

async function reminderCandidates(type,month){if(type==='monthly'){const billing=monthValue(month);return db('monthly_bills as b').join('members as m','b.member_id','m.id').whereIn('b.status',['unpaid','partial']).modify(q=>{if(billing)q.where('b.billing_month',billing)}).whereNotNull('m.phone').select('b.id','m.id as member_id','m.name','m.phone',db.raw("(b.amount_due-b.amount_paid) as outstanding"),'b.billing_month as due_date');}if(type==='pledge')return db('donation_pledges').whereIn('status',['active','partial','overdue']).whereNotNull('phone').select('id','member_id','donor_name as name','phone',db.raw('(pledged_amount-paid_amount) as outstanding'),'due_date');if(type==='loan')return db('mosque_loans').whereIn('status',['active','overdue']).whereNotNull('phone').select('id','member_id','borrower_name as name','phone',db.raw('(principal_amount-repaid_amount) as outstanding'),'final_due_date as due_date');throw new Error('Invalid reminder type');}
async function prepareReminders(type,month,userId){const candidates=await reminderCandidates(type,month);const template=await db('communication_templates').where({channel:'sms',is_active:true}).where(type==='monthly'?{name:'মাসিক চাঁদা স্মরণিকা'}:type==='pledge'?{name:'দান অঙ্গীকার স্মরণিকা'}:{name:'ঋণ কিস্তি স্মরণিকা'}).first();if(!template)throw new Error('Reminder template is missing');const sourceType=type==='monthly'?'monthly_bill':type;let created=0;for(const c of candidates){const duplicate=await db('communications').where({source_type:sourceType,source_id:c.id}).whereIn('status',['draft','approved','sending','sent']).first();if(duplicate)continue;await db('communications').insert({template_id:template.id,member_id:c.member_id||null,monthly_bill_id:type==='monthly'?c.id:null,channel:'sms',recipient_name:c.name,recipient_address:c.phone,body:render(template.body,{name:c.name,month, outstanding:Number(c.outstanding).toFixed(2),message:''}),status:'draft',source_type:sourceType,source_id:c.id,created_by:userId});created++;}return{candidates:candidates.length,created};}

module.exports = { templates, recipients, history, createDraft, createBulkDrafts, find, updateTemplate, approve, sendApproved, schedule, queue, attempts, deliverySummary, processDue, reminderCandidates, prepareReminders, providerStatus: smsProvider.status };
