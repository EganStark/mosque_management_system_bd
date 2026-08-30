const db = require("../config/db");
const periods = require("./accounting-periods");
const paymentGuards = require("./payment-guards");
const { assertIndependentApproval } = require('./approval-separation');
const options = {
  assets: () =>
    db("assets")
      .where({ status: "active" })
      .select("id", "asset_code", "name")
      .orderBy("name"),
  facilities: () =>
    db("facilities")
      .where({ is_active: true })
      .select("id", "name")
      .orderBy("name"),
  staff: () =>
    db("staff_members")
      .where({ is_active: true })
      .whereNot({ employment_status: "left" })
      .select("id", "name_bn", "position_bn")
      .orderBy("sort_order"),
  vendors: () =>
    db("maintenance_vendors").where({ is_active: true }).orderBy("name"),
};
async function summary() {
  const row = await db("maintenance_work_orders").first(
    db.raw(
      "COUNT(*) FILTER(WHERE status IN ('open','assigned','in_progress'))::int as active",
    ),
    db.raw(
      "COUNT(*) FILTER(WHERE priority='critical' AND status NOT IN ('completed','cancelled'))::int as critical",
    ),
    db.raw(
      "COUNT(*) FILTER(WHERE scheduled_date BETWEEN CURRENT_DATE AND CURRENT_DATE+INTERVAL '7 days' AND status NOT IN ('completed','cancelled'))::int as due",
    ),
    db.raw(
      "COALESCE(SUM(actual_cost) FILTER(WHERE status='completed' AND completed_date>=date_trunc('month',CURRENT_DATE)),0) as month_cost",
    ),
  );
  return {
    active: Number(row.active || 0),
    critical: Number(row.critical || 0),
    due: Number(row.due || 0),
    monthCost: Number(row.month_cost || 0),
  };
}
async function list() {
  return db("maintenance_work_orders as w")
    .leftJoin("assets as a", "w.asset_id", "a.id")
    .leftJoin("facilities as f", "w.facility_id", "f.id")
    .leftJoin("maintenance_vendors as v", "w.vendor_id", "v.id")
    .leftJoin("staff_members as s", "w.assigned_staff_id", "s.id")
    .select(
      "w.*",
      "a.name as asset_name",
      "a.asset_code",
      "f.name as facility_name",
      "v.name as vendor_name",
      "s.name_bn as staff_name",
    )
    .orderByRaw(
      "CASE w.priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END",
    )
    .orderBy("w.id", "desc");
}
async function createVendor(data) {
  return (
    await db("maintenance_vendors")
      .insert({
        name: data.name,
        contact_person: data.contact_person || null,
        phone: data.phone || null,
        email: data.email || null,
        address: data.address || null,
        service_type: data.service_type || null,
      })
      .returning("*")
  )[0];
}
async function create(data, userId) {
  if (!data.asset_id && !data.facility_id)
    throw new Error("Select an asset or facility");
  const seq = await db.raw(
    "SELECT nextval('maintenance_work_order_seq') as value",
  );
  return (
    await db("maintenance_work_orders")
      .insert({
        work_order_no: `WO-${new Date().getFullYear()}-${String(seq.rows[0].value).padStart(6, "0")}`,
        asset_id: data.asset_id || null,
        facility_id: data.facility_id || null,
        vendor_id: data.vendor_id || null,
        assigned_staff_id: data.assigned_staff_id || null,
        title: data.title,
        description: data.description,
        maintenance_type: data.maintenance_type,
        priority: data.priority,
        reported_date: data.reported_date,
        scheduled_date: data.scheduled_date || null,
        estimated_cost: data.estimated_cost || 0,
        status: data.assigned_staff_id || data.vendor_id ? "assigned" : "open",
        created_by: userId,
      })
      .returning("*")
  )[0];
}
async function find(id) {
  const item = await db("maintenance_work_orders as w")
    .leftJoin("assets as a", "w.asset_id", "a.id")
    .leftJoin("facilities as f", "w.facility_id", "f.id")
    .leftJoin("maintenance_vendors as v", "w.vendor_id", "v.id")
    .leftJoin("staff_members as s", "w.assigned_staff_id", "s.id")
    .select(
      "w.*",
      "a.name as asset_name",
      "a.asset_code",
      "f.name as facility_name",
      "v.name as vendor_name",
      "v.phone as vendor_phone",
      "s.name_bn as staff_name",
    )
    .where("w.id", id)
    .first();
  if (item) item.completionRequests = await db("maintenance_completion_requests as r")
    .leftJoin("users as requester", "r.requested_by", "requester.id")
    .leftJoin("users as decider", "r.decided_by", "decider.id")
    .select("r.*", "requester.name as requester_name", "decider.name as decider_name")
    .where("r.work_order_id", id).orderBy("r.requested_at", "desc");
  return item;
}
async function setStatus(id, status) {
  if (!["open", "assigned", "in_progress", "cancelled"].includes(status))
    throw new Error("Invalid work order status");
  const item = await db("maintenance_work_orders").where({ id }).first();
  if (!item || item.status === "completed")
    throw new Error("Completed work order cannot be changed");
  await db("maintenance_work_orders")
    .where({ id })
    .update({ status, updated_at: db.fn.now() });
}
async function complete(id, data, userId, connection = null) {
  const execute = async (trx) => {
    await periods.assertOpen(data.completed_date, trx);
    const item = await trx("maintenance_work_orders")
      .where({ id })
      .forUpdate()
      .first();
    if (!item || ["completed", "cancelled"].includes(item.status))
      throw new Error("Work order cannot be completed");
    const cost = Number(data.actual_cost || 0);
    let expenseId = null;
    if (cost > 0) {
      const bankId = await paymentGuards.bankIdFor(data, trx);
      const walletId = await paymentGuards.walletIdFor(data, trx);
      await paymentGuards.assertOutgoingFunds({
        payment_method: data.payment_method,
        bank_id: bankId,
        mobile_wallet_id: walletId,
        date: data.completed_date,
      }, cost, trx);
      const head = await trx("expense_heads")
        .where({ name: "মেরামত ও রক্ষণাবেক্ষণ" })
        .first();
      if (!head) throw new Error("Maintenance expense head is missing");
      const seq = await trx.raw(
        "SELECT nextval('expense_voucher_seq') as value",
      );
      const [expense] = await trx("expenses")
        .insert({
          expense_head_id: head.id,
          purpose: `Maintenance ${item.work_order_no}: ${item.title}`,
          amount: cost,
          date: data.completed_date,
          voucher_no: `VCHR-${new Date().getFullYear()}-${String(seq.rows[0].value).padStart(6, "0")}`,
          payee: data.payee || null,
          payment_method: data.payment_method,
          bank_id: bankId,
          mobile_wallet_id: walletId,
          transaction_reference: data.reference || null,
          remarks: data.completion_notes || null,
          status: "posted",
          created_by: userId,
        })
        .returning("*");
      expenseId = expense.id;
    }
    await trx("maintenance_work_orders")
      .where({ id })
      .update({
        status: "completed",
        completed_date: data.completed_date,
        actual_cost: cost,
        next_maintenance_date: data.next_maintenance_date || null,
        completion_notes: data.completion_notes || null,
        expense_id: expenseId,
        completion_request_id: data.completion_request_id || null,
        completed_by: userId,
        updated_at: trx.fn.now(),
      });
    if (item.asset_id)
      await trx("asset_maintenance").insert({
        asset_id: item.asset_id,
        maintenance_date: data.completed_date,
        maintenance_type: item.maintenance_type,
        description: item.title,
        service_provider: data.payee || null,
        cost,
        next_maintenance_date: data.next_maintenance_date || null,
        created_by: userId,
      });
    return trx("maintenance_work_orders").where({ id }).first();
  };
  return connection ? execute(connection) : db.transaction(execute);
}
async function requestCompletion(id, data, userId) {
  return db.transaction(async (trx) => {
    await periods.assertOpen(data.completed_date, trx);
    const item = await trx("maintenance_work_orders").where({ id }).forUpdate().first();
    if (!item || ["completed", "cancelled"].includes(item.status)) throw new Error("Work order cannot be completed");
    if (await trx("maintenance_completion_requests").where({ work_order_id: id }).whereIn("status", ["pending", "processing"]).first()) throw new Error("A completion request is already pending");
    const cost = Number(data.actual_cost || 0);
    if (!Number.isFinite(cost) || cost < 0) throw new Error("Enter a valid actual cost");
    const bankId = cost > 0 ? await paymentGuards.bankIdFor(data, trx) : null;
    const walletId = cost > 0 ? await paymentGuards.walletIdFor(data, trx) : null;
    return (await trx("maintenance_completion_requests").insert({ work_order_id: id, completed_date: data.completed_date, actual_cost: cost, next_maintenance_date: data.next_maintenance_date || null, completion_notes: data.completion_notes || null, payee: data.payee || null, payment_method: data.payment_method || "cash", bank_id: bankId, mobile_wallet_id: walletId, reference: data.reference || null, requested_by: userId }).returning("*"))[0];
  });
}
async function decideCompletion(requestId, decision, notes, userId) {
  if (!["approved", "rejected"].includes(decision)) throw new Error("Invalid completion decision");
  return db.transaction(async (trx) => {
    const row = await trx("maintenance_completion_requests").where({ id: requestId }).forUpdate().first();
    if (!row || row.status !== "pending") throw new Error("This completion request has already been decided");
    if (decision === "rejected") { await trx("maintenance_completion_requests").where({ id: requestId }).update({ status: "rejected", decided_by: userId, decided_at: trx.fn.now(), decision_notes: notes || null }); return null; }
    await assertIndependentApproval(trx, row.requested_by, userId, 'maintenance completion');
    const workOrder = await complete(row.work_order_id, { ...row, completion_request_id: row.id }, userId, trx);
    await trx("maintenance_completion_requests").where({ id: requestId }).update({ status: "approved", decided_by: userId, decided_at: trx.fn.now(), decision_notes: notes || null });
    return workOrder;
  });
}
module.exports = {
  options,
  summary,
  list,
  createVendor,
  create,
  find,
  setStatus,
  complete,
  requestCompletion,
  decideCompletion,
};
