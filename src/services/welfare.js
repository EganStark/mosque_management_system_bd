const db = require("../config/db");
const periods = require("./accounting-periods");
const paymentGuards = require("./payment-guards");
const expenses = require("./expenses");
const { assertIndependentApproval } = require('./approval-separation');
async function summary() {
  const row = await db("welfare_applications").first(
    db.raw("COUNT(*) FILTER(WHERE status='pending')::int as pending"),
    db.raw(
      "COUNT(*) FILTER(WHERE urgency='emergency' AND status='pending')::int as urgent",
    ),
    db.raw("COALESCE(SUM(approved_amount),0) as approved"),
    db.raw("COALESCE(SUM(disbursed_amount),0) as disbursed"),
  );
  const b = await db("welfare_beneficiaries")
    .where({ eligibility_status: "eligible" })
    .count("* as c")
    .first();
  return {
    pending: Number(row.pending || 0),
    urgent: Number(row.urgent || 0),
    approved: Number(row.approved || 0),
    disbursed: Number(row.disbursed || 0),
    eligible: Number(b.c || 0),
  };
}
async function list() {
  return db("welfare_applications as a")
    .join("welfare_beneficiaries as b", "a.beneficiary_id", "b.id")
    .select(
      "a.*",
      "b.name as beneficiary_name",
      "b.phone",
      "b.eligibility_status",
    )
    .orderByRaw(
      "CASE WHEN a.urgency='emergency' THEN 0 WHEN a.urgency='urgent' THEN 1 ELSE 2 END",
    )
    .orderBy("a.id", "desc");
}
async function beneficiaryOptions() {
  return db("welfare_beneficiaries")
    .select("id", "name", "phone", "eligibility_status")
    .orderBy("name");
}
async function createBeneficiary(data, userId) {
  const member = data.member_id
    ? await db("members").where({ id: data.member_id }).first()
    : null;
  const [row] = await db("welfare_beneficiaries")
    .insert({
      member_id: member ? member.id : null,
      name: member ? member.name : data.name,
      phone: (member && member.phone) || data.phone || null,
      address: (member && member.address_text) || data.address || null,
      household_size: data.household_size || null,
      monthly_income: data.monthly_income || null,
      identity_reference: data.identity_reference || null,
      verification_notes: data.verification_notes || null,
      created_by: userId,
    })
    .returning("*");
  return row;
}
async function verifyBeneficiary(id, status, notes, userId) {
  if (!["eligible", "ineligible", "pending"].includes(status))
    throw new Error("Invalid eligibility status");
  await db("welfare_beneficiaries")
    .where({ id })
    .update({
      eligibility_status: status,
      verification_notes: notes || null,
      verified_by: userId,
      verified_at: db.fn.now(),
      updated_at: db.fn.now(),
    });
}
async function createApplication(data, userId) {
  const beneficiary = await db("welfare_beneficiaries")
    .where({ id: data.beneficiary_id })
    .first();
  if (!beneficiary) throw new Error("Beneficiary not found");
  const seq = await db.raw(
    "SELECT nextval('welfare_application_no_seq') as value",
  );
  const [row] = await db("welfare_applications")
    .insert({
      beneficiary_id: beneficiary.id,
      application_no: `WEL-${new Date().getFullYear()}-${String(seq.rows[0].value).padStart(6, "0")}`,
      assistance_type: data.assistance_type,
      fund_source: data.fund_source,
      reason: data.reason,
      requested_amount: data.requested_amount,
      urgency: data.urgency || "normal",
      created_by: userId,
    })
    .returning("*");
  return row;
}
async function find(id) {
  const item = await db("welfare_applications as a")
    .join("welfare_beneficiaries as b", "a.beneficiary_id", "b.id")
    .select(
      "a.*",
      "b.name as beneficiary_name",
      "b.phone",
      "b.address",
      "b.household_size",
      "b.monthly_income",
      "b.identity_reference",
      "b.eligibility_status",
      "b.verification_notes",
    )
    .where("a.id", id)
    .first();
  if (!item) return null;
  item.disbursements = await db("welfare_disbursements as d")
    .leftJoin("users as u", "d.disbursed_by", "u.id")
    .select("d.*", "u.name as disbursed_by_name")
    .where("d.application_id", id)
    .orderBy("d.disbursement_date", "desc");
  item.disbursementRequests = await db('welfare_disbursement_requests as r')
    .leftJoin('users as u', 'r.requested_by', 'u.id')
    .leftJoin('users as a', 'r.decided_by', 'a.id')
    .leftJoin('banks as b', 'r.bank_id', 'b.id')
    .leftJoin('mobile_wallets as w', 'r.mobile_wallet_id', 'w.id')
    .where('r.application_id', id)
    .select('r.*', 'u.name as requester_name', 'a.name as decision_by_name', 'b.name as bank_name', 'w.name as wallet_name')
    .orderBy('r.requested_at', 'desc');
  return item;
}
async function decide(id, data, userId) {
  return db.transaction(async (trx) => {
    const item = await trx("welfare_applications")
      .where({ id })
      .forUpdate()
      .first();
    if (!item || item.status !== "pending")
      throw new Error("Only pending applications can be decided");
    if (data.status === "approved") {
      const beneficiary = await trx("welfare_beneficiaries")
        .where({ id: item.beneficiary_id })
        .first();
      if (!beneficiary || beneficiary.eligibility_status !== "eligible")
        throw new Error("Verify the beneficiary as eligible before approval");
      const amount = Number(data.approved_amount);
      if (
        !Number.isFinite(amount) ||
        amount <= 0 ||
        amount > Number(item.requested_amount)
      )
        throw new Error("Approved amount must be within the requested amount");
      await trx("welfare_applications")
        .where({ id })
        .update({
          status: "approved",
          approved_amount: amount,
          decision_notes: data.decision_notes || null,
          approved_by: userId,
          approved_at: trx.fn.now(),
          updated_at: trx.fn.now(),
        });
    } else if (data.status === "rejected") {
      await trx("welfare_applications")
        .where({ id })
        .update({
          status: "rejected",
          decision_notes: data.decision_notes || null,
          approved_by: userId,
          approved_at: trx.fn.now(),
          updated_at: trx.fn.now(),
        });
    } else throw new Error("Invalid decision");
  });
}
async function disburse(id, data, userId, connection = null) {
  const execute = async (trx) => {
    await periods.assertOpen(data.disbursement_date, trx);
    const bankId = await paymentGuards.bankIdFor(data, trx);
    const walletId = await paymentGuards.walletIdFor(data, trx);
    const item = await trx("welfare_applications as a")
      .join("welfare_beneficiaries as b", "a.beneficiary_id", "b.id")
      .select("a.*", "b.name as beneficiary_name")
      .where("a.id", id)
      .forUpdate()
      .first();
    if (!item || !["approved", "partial"].includes(item.status))
      throw new Error("Application is not approved");
    const amount = Number(data.amount),
      remaining = Number(item.approved_amount) - Number(item.disbursed_amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > remaining)
      throw new Error("Amount must be within approved balance");
    await paymentGuards.assertOutgoingFunds({
      payment_method: data.payment_method,
      bank_id: bankId,
      mobile_wallet_id: walletId,
      date: data.disbursement_date,
    }, amount, trx);
    const head = await trx("expense_heads")
      .where({ name: "কল্যাণ ও সহায়তা" })
      .first();
    const budgetPosition = await expenses.budgetPosition({
      expense_head_id: head ? head.id : null,
      date: data.disbursement_date,
      amount,
    }, trx);
    const budgetOverrideReason = String(data.budget_override_reason || "").trim();
    if (budgetPosition?.exceeds && !budgetOverrideReason) {
      const overage = budgetPosition.spent + budgetPosition.requested - budgetPosition.budget;
      throw new Error(`Welfare release exceeds its budget line by ${overage.toFixed(2)}; enter an override reason`);
    }
    const seq = await trx.raw("SELECT nextval('expense_voucher_seq') as value");
    const [expense] = await trx("expenses")
      .insert({
        expense_head_id: head ? head.id : null,
        purpose: `Welfare ${item.application_no} (${item.fund_source})`,
        amount,
        date: data.disbursement_date,
        voucher_no: `VCHR-${new Date().getFullYear()}-${String(seq.rows[0].value).padStart(6, "0")}`,
        payee: item.beneficiary_name,
          payment_method: data.payment_method,
          bank_id: bankId,
          mobile_wallet_id: walletId,
        transaction_reference: data.reference || null,
        remarks: data.remarks || null,
        status: "posted",
        budget_amount_at_approval: budgetPosition ? budgetPosition.budget : null,
        budget_spent_before: budgetPosition ? budgetPosition.spent : null,
        budget_override_reason: budgetPosition?.exceeds ? budgetOverrideReason : null,
        created_by: userId,
      })
      .returning("*");
    const [disbursement] = await trx("welfare_disbursements").insert({
      application_id: id,
      expense_id: expense.id,
      amount,
      disbursement_date: data.disbursement_date,
      payment_method: data.payment_method,
      reference: data.reference || null,
      remarks: data.remarks || null,
      disbursed_by: userId,
    }).returning("*");
    const total = Number(item.disbursed_amount) + amount;
    await trx("welfare_applications")
      .where({ id })
      .update({
        disbursed_amount: total,
        status: total >= Number(item.approved_amount) ? "paid" : "partial",
        updated_at: trx.fn.now(),
      });
    return disbursement;
  };
  return connection ? execute(connection) : db.transaction(execute);
}

async function requestDisbursement(id, data, userId) {
  return db.transaction(async (trx) => {
    const item = await trx('welfare_applications').where({ id }).forUpdate().first();
    if (!item || !['approved', 'partial'].includes(item.status)) throw new Error('Application is not approved');
    const bankId = await paymentGuards.bankIdFor(data, trx);
    const walletId = await paymentGuards.walletIdFor(data, trx);
    const amount = Number(data.amount);
    const reservedRow = await trx('welfare_disbursement_requests').where({ application_id: id }).whereIn('status', ['pending', 'processing']).sum('amount as total').first();
    const available = Number(item.approved_amount) - Number(item.disbursed_amount) - Number(reservedRow.total || 0);
    if (!Number.isFinite(amount) || amount <= 0 || amount > available) throw new Error('Amount exceeds the unreserved approved balance');
    const [request] = await trx('welfare_disbursement_requests').insert({
      application_id: id, amount, disbursement_date: data.disbursement_date,
      payment_method: data.payment_method, bank_id: bankId, mobile_wallet_id: walletId,
      reference: data.reference || null, remarks: data.remarks || null, requested_by: userId,
    }).returning('*');
    return request;
  });
}

async function decideDisbursement(requestId, decision, notes, userId, options = {}) {
  if (!['approve', 'reject'].includes(decision)) throw new Error('Invalid disbursement decision');
  return db.transaction(async (trx) => {
    const row = await trx('welfare_disbursement_requests').where({ id: requestId }).forUpdate().first();
    if (!row || row.status !== 'pending') throw new Error('Only a pending disbursement can be decided');
    if (decision === 'reject') {
      await trx('welfare_disbursement_requests').where({ id: requestId }).update({ status: 'rejected', decided_by: userId, decided_at: trx.fn.now(), decision_notes: String(notes || '').trim() || null });
      return null;
    }
    await assertIndependentApproval(trx, row.requested_by, userId, 'welfare release');
    const disbursement = await disburse(row.application_id, {
      ...row,
      budget_override_reason: options.budget_override_reason,
    }, userId, trx);
    await trx('welfare_disbursement_requests').where({ id: requestId }).update({ status: 'approved', disbursement_id: disbursement.id, decided_by: userId, decided_at: trx.fn.now(), decision_notes: String(notes || '').trim() || null });
    return disbursement;
  });
}
module.exports = {
  summary,
  list,
  beneficiaryOptions,
  createBeneficiary,
  verifyBeneficiary,
  createApplication,
  find,
  decide,
  disburse,
  requestDisbursement,
  decideDisbursement,
};
