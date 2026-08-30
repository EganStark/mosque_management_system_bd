const db = require("../config/db");
const accountingPeriods = require("./accounting-periods");
const paymentGuards = require("./payment-guards");
const { assertIndependentApproval } = require('./approval-separation');
const expenses = require('./expenses');
async function options() {
  return {
    vendors: await db("maintenance_vendors")
      .where({ is_active: true })
      .orderBy("name"),
    workOrders: await db("maintenance_work_orders")
      .whereNotIn("status", ["completed", "cancelled"])
      .select("id", "work_order_no", "title")
      .orderBy("id", "desc"),
    banks: await db("banks").where({ is_active: true }).orderBy("name"),
  };
}
async function summary() {
  const r = await db("purchase_requests as pr")
    .leftJoin("purchase_orders as po", "pr.id", "po.request_id")
    .first(
      db.raw(
        "COUNT(DISTINCT pr.id) FILTER(WHERE pr.status IN ('draft','submitted'))::int pending",
      ),
      db.raw(
        "COUNT(DISTINCT pr.id) FILTER(WHERE pr.status='approved')::int approved",
      ),
      db.raw(
        "COUNT(DISTINCT po.id) FILTER(WHERE po.status='issued')::int ordered",
      ),
      db.raw(
        "COALESCE(SUM(po.order_total) FILTER(WHERE po.order_date>=date_trunc('month',CURRENT_DATE)),0) month_value",
      ),
    );
  return {
    pending: Number(r.pending || 0),
    approved: Number(r.approved || 0),
    ordered: Number(r.ordered || 0),
    monthValue: Number(r.month_value || 0),
  };
}
async function list() {
  return db("purchase_requests as r")
    .leftJoin("purchase_orders as o", "r.id", "o.request_id")
    .leftJoin("maintenance_vendors as v", "o.vendor_id", "v.id")
    .select(
      "r.*",
      "o.id as order_id",
      "o.order_no",
      "o.status as order_status",
      "v.name as vendor_name",
    )
    .orderBy("r.id", "desc");
}
function normalizeItems(data) {
  let names = data.item_name || [],
    specs = data.specification || [],
    quantities = data.quantity || [],
    units = data.unit || [],
    costs = data.estimated_unit_cost || [];
  if (!Array.isArray(names)) {
    names = [names];
    specs = [specs];
    quantities = [quantities];
    units = [units];
    costs = [costs];
  }
  return names
    .map((name, i) => ({
      item_name: String(name || "").trim(),
      specification: String(specs[i] || "").trim() || null,
      quantity: Number(quantities[i]),
      unit: String(units[i] || "").trim(),
      estimated_unit_cost: Number(costs[i] || 0),
    }))
    .filter((x) => x.item_name && x.unit && x.quantity > 0);
}
async function create(data, userId) {
  const items = normalizeItems(data);
  if (!items.length) throw new Error("Add at least one valid purchase item");
  return db.transaction(async (trx) => {
    const seq = (
      await trx.raw("SELECT nextval('purchase_request_no_seq') value")
    ).rows[0].value;
    const estimated = items.reduce(
      (s, x) => s + x.quantity * x.estimated_unit_cost,
      0,
    );
    const request = (
      await trx("purchase_requests")
        .insert({
          request_no: `PR-${new Date().getFullYear()}-${String(seq).padStart(6, "0")}`,
          title: data.title,
          justification: data.justification,
          request_date: data.request_date,
          needed_by: data.needed_by || null,
          priority: data.priority,
          estimated_total: estimated,
          maintenance_work_order_id: data.maintenance_work_order_id || null,
          requested_by: userId,
        })
        .returning("*")
    )[0];
    await trx("purchase_request_items").insert(
      items.map((x) => ({ ...x, request_id: request.id })),
    );
    return request;
  });
}
async function find(id) {
  const item = await db("purchase_requests as r")
    .leftJoin("users as u", "r.requested_by", "u.id")
    .leftJoin(
      "maintenance_work_orders as w",
      "r.maintenance_work_order_id",
      "w.id",
    )
    .select(
      "r.*",
      "u.name as requester_name",
      "w.work_order_no",
      "w.title as work_order_title",
    )
    .where("r.id", id)
    .first();
  if (!item) return null;
  item.items = await db("purchase_request_items")
    .where({ request_id: id })
    .orderBy("id");
  item.quotations = await db("procurement_quotations as q")
    .join("maintenance_vendors as v", "q.vendor_id", "v.id")
    .select("q.*", "v.name as vendor_name", "v.phone as vendor_phone")
    .where("q.request_id", id)
    .orderBy("q.quoted_amount");
  item.order = await db("purchase_orders as o")
    .join("maintenance_vendors as v", "o.vendor_id", "v.id")
    .select(
      "o.*",
      "v.name as vendor_name",
      "v.phone as vendor_phone",
      "v.address as vendor_address",
    )
    .where("o.request_id", id)
    .first();
  if (item.order) {
    item.receipts = await db("goods_receipts")
      .where({ purchase_order_id: item.order.id })
      .orderBy("received_date");
    item.payments = await db("purchase_payments as p")
      .leftJoin("expenses as e", "p.expense_id", "e.id")
      .leftJoin("users as payer", "p.paid_by", "payer.id")
      .leftJoin("users as canceller", "e.cancelled_by", "canceller.id")
      .select("p.*", "payer.name as payer_name", "e.cancellation_reason", "e.cancelled_at", "canceller.name as cancelled_by_name")
      .where("p.purchase_order_id", item.order.id)
      .orderBy("p.payment_date");
    item.paymentRequests = await db("purchase_payment_requests as r")
      .leftJoin("users as requester", "r.requested_by", "requester.id")
      .leftJoin("users as decider", "r.decided_by", "decider.id")
      .select("r.*", "requester.name as requester_name", "decider.name as decider_name")
      .where("r.purchase_order_id", item.order.id)
      .orderBy("r.requested_at", "desc");
  }
  return item;
}
async function submit(id) {
  const n = await db("purchase_requests")
    .where({ id, status: "draft" })
    .update({ status: "submitted", updated_at: db.fn.now() });
  if (!n) throw new Error("Only draft requests can be submitted");
}
async function decide(id, status, notes, userId) {
  if (!["approved", "rejected"].includes(status))
    throw new Error("Invalid decision");
  const n = await db("purchase_requests")
    .where({ id, status: "submitted" })
    .update({
      status,
      decision_notes: notes || null,
      approved_by: userId,
      approved_at: db.fn.now(),
      updated_at: db.fn.now(),
    });
  if (!n) throw new Error("Only submitted requests can be decided");
}
async function addQuotation(id, data, userId) {
  const request = await db("purchase_requests")
    .where({ id, status: "approved" })
    .first();
  if (!request)
    throw new Error("Approve the request before collecting quotations");
  return (
    await db("procurement_quotations")
      .insert({
        request_id: id,
        vendor_id: data.vendor_id,
        quotation_ref: data.quotation_ref || null,
        quotation_date: data.quotation_date,
        quoted_amount: data.quoted_amount,
        delivery_days: data.delivery_days || null,
        terms: data.terms || null,
        recorded_by: userId,
      })
      .onConflict(["request_id", "vendor_id"])
      .merge()
      .returning("*")
  )[0];
}
async function createOrder(id, data, userId) {
  return db.transaction(async (trx) => {
    const request = await trx("purchase_requests")
      .where({ id, status: "approved" })
      .forUpdate()
      .first();
    if (!request) throw new Error("Request is not approved or already ordered");
    const quote = await trx("procurement_quotations")
      .where({ id: data.quotation_id, request_id: id })
      .first();
    if (!quote) throw new Error("Select a valid quotation");
    if (await trx("purchase_orders").where({ request_id: id }).first())
      throw new Error("Purchase order already exists");
    const seq = (await trx.raw("SELECT nextval('purchase_order_no_seq') value"))
      .rows[0].value;
    await trx("procurement_quotations")
      .where({ request_id: id })
      .update({ is_selected: false });
    await trx("procurement_quotations")
      .where({ id: quote.id })
      .update({ is_selected: true });
    const order = (
      await trx("purchase_orders")
        .insert({
          order_no: `PO-${new Date().getFullYear()}-${String(seq).padStart(6, "0")}`,
          request_id: id,
          quotation_id: quote.id,
          vendor_id: quote.vendor_id,
          order_date: data.order_date,
          expected_delivery: data.expected_delivery || null,
          order_total: quote.quoted_amount,
          terms: data.terms || quote.terms,
          created_by: userId,
        })
        .returning("*")
    )[0];
    await trx("purchase_requests")
      .where({ id })
      .update({ status: "ordered", updated_at: trx.fn.now() });
    return order;
  });
}
async function receive(orderId, data, userId) {
  return db.transaction(async (trx) => {
    const order = await trx("purchase_orders")
      .where({ id: orderId })
      .forUpdate()
      .first();
    if (!order || !["issued", "part_received"].includes(order.status))
      throw new Error("This order cannot be received");
    const seq = (await trx.raw("SELECT nextval('goods_receipt_no_seq') value"))
      .rows[0].value;
    const receipt = (
      await trx("goods_receipts")
        .insert({
          receipt_no: `GRN-${new Date().getFullYear()}-${String(seq).padStart(6, "0")}`,
          purchase_order_id: orderId,
          received_date: data.received_date,
          delivery_reference: data.delivery_reference || null,
          inspection_notes: data.inspection_notes,
          condition_status: data.condition_status,
          received_by: userId,
        })
        .returning("*")
    )[0];
    const status =
      data.condition_status === "accepted"
        ? "received"
        : data.condition_status === "partial"
          ? "part_received"
          : "issued";
    await trx("purchase_orders")
      .where({ id: orderId })
      .update({
        status,
        updated_at: trx.fn.now(),
      });
    return receipt;
  });
}
async function pay(orderId, data, userId, connection = null) {
  const execute = async (trx) => {
    await accountingPeriods.assertOpen(data.payment_date, trx);
    const bankId = await paymentGuards.bankIdFor(data, trx);
    const walletId = await paymentGuards.walletIdFor(data, trx);
    const order = await trx("purchase_orders as o")
      .join("maintenance_vendors as v", "o.vendor_id", "v.id")
      .select("o.*", "v.name as vendor_name")
      .where("o.id", orderId)
      .forUpdate()
      .first();
    if (!order || order.status !== "received")
      throw new Error("Accept the goods before payment");
    const paid = Number(
      (
        await trx("purchase_payments")
          .where({ purchase_order_id: orderId, status: "posted" })
          .sum("amount as total")
          .first()
      ).total || 0,
    );
    const amount = Number(data.amount);
    if (
      !Number.isFinite(amount) ||
      amount <= 0 ||
      paid + amount > Number(order.order_total)
    )
      throw new Error("Payment exceeds the outstanding order amount");
    await paymentGuards.assertOutgoingFunds({
      payment_method: data.payment_method,
      bank_id: bankId,
      mobile_wallet_id: walletId,
      date: data.payment_date,
    }, amount, trx);
    const head = await trx("expense_heads")
      .where({ name: "ক্রয় ও সরবরাহ" })
      .first();
    const budgetPosition = await expenses.budgetPosition({ expense_head_id: head?.id || null, date: data.payment_date, amount }, trx);
    const budgetOverrideReason = String(data.budget_override_reason || '').trim();
    if (budgetPosition?.exceeds && !budgetOverrideReason) throw new Error(`Supplier payment exceeds its budget line by ${(budgetPosition.spent + budgetPosition.requested - budgetPosition.budget).toFixed(2)}; enter an override reason`);
    const seq = (await trx.raw("SELECT nextval('expense_voucher_seq') value"))
      .rows[0].value;
    const expense = (
      await trx("expenses")
        .insert({
          expense_head_id: head?.id || null,
          purpose: `Purchase ${order.order_no}`,
          amount,
          date: data.payment_date,
          voucher_no: `VCHR-${new Date().getFullYear()}-${String(seq).padStart(6, "0")}`,
          payee: order.vendor_name,
          payment_method: data.payment_method,
          bank_id: bankId,
          mobile_wallet_id: walletId,
          transaction_reference: data.reference || null,
          remarks: `Procurement payment for ${order.order_no}`,
          status: "posted",
          created_by: userId,
          budget_amount_at_approval: budgetPosition ? budgetPosition.budget : null,
          budget_spent_before: budgetPosition ? budgetPosition.spent : null,
          budget_override_reason: budgetPosition?.exceeds ? budgetOverrideReason : null,
        })
        .returning("*")
    )[0];
    const payment = (await trx("purchase_payments").insert({
      purchase_order_id: orderId,
      expense_id: expense.id,
      amount,
      payment_date: data.payment_date,
      payment_method: data.payment_method,
      reference: data.reference || null,
      paid_by: userId,
    }).returning("*"))[0];
    if (paid + amount >= Number(order.order_total))
      await trx("purchase_orders")
        .where({ id: orderId })
        .update({ status: "paid", updated_at: trx.fn.now() });
    return payment;
  };
  return connection ? execute(connection) : db.transaction(execute);
}

async function requestPayment(orderId, data, userId) {
  return db.transaction(async (trx) => {
    await accountingPeriods.assertOpen(data.payment_date, trx);
    const bankId = await paymentGuards.bankIdFor(data, trx);
    const walletId = await paymentGuards.walletIdFor(data, trx);
    const order = await trx("purchase_orders").where({ id: orderId }).forUpdate().first();
    if (!order || order.status !== "received") throw new Error("Accept the goods before requesting payment");
    const paid = Number((await trx("purchase_payments").where({ purchase_order_id: orderId, status: "posted" }).sum("amount as total").first()).total || 0);
    const reserved = Number((await trx("purchase_payment_requests").where({ purchase_order_id: orderId }).whereIn("status", ["pending", "processing"]).sum("amount as total").first()).total || 0);
    const amount = Number(data.amount);
    if (!Number.isFinite(amount) || amount <= 0 || paid + reserved + amount > Number(order.order_total)) {
      throw new Error("Payment exceeds the unreserved outstanding order amount");
    }
    return (await trx("purchase_payment_requests").insert({
      purchase_order_id: orderId, amount, payment_date: data.payment_date,
      payment_method: data.payment_method, bank_id: bankId, mobile_wallet_id: walletId,
      reference: data.reference || null, remarks: data.remarks || null, requested_by: userId,
    }).returning("*"))[0];
  });
}

async function decidePayment(requestId, decision, notes, userId, options = {}) {
  if (!["approved", "rejected"].includes(decision)) throw new Error("Invalid payment decision");
  return db.transaction(async (trx) => {
    const row = await trx("purchase_payment_requests").where({ id: requestId }).forUpdate().first();
    if (!row || row.status !== "pending") throw new Error("This payment request has already been decided");
    if (decision === "rejected") {
      await trx("purchase_payment_requests").where({ id: requestId }).update({ status: "rejected", decided_by: userId, decided_at: trx.fn.now(), decision_notes: notes || null });
      return null;
    }
    await assertIndependentApproval(trx, row.requested_by, userId, 'supplier payment');
    const payment = await pay(row.purchase_order_id, { ...row, budget_override_reason: options.budget_override_reason }, userId, trx);
    await trx("purchase_payment_requests").where({ id: requestId }).update({ status: "approved", purchase_payment_id: payment.id, decided_by: userId, decided_at: trx.fn.now(), decision_notes: notes || null });
    return payment;
  });
}

async function cancelPayment(orderId, paymentId, reason, userId) {
  const cancellationReason = String(reason || "").trim();
  if (!cancellationReason) throw new Error("A cancellation reason is required");
  const payment = await db("purchase_payments").where({ id: paymentId, purchase_order_id: orderId }).first();
  if (!payment) throw new Error("Supplier payment not found");
  if (payment.status !== "posted") throw new Error("This supplier payment is already cancelled");
  const changed = await require("./expenses").cancel(payment.expense_id, {
    cancelled_by: userId,
    cancellation_reason: cancellationReason,
  });
  if (!changed) throw new Error("This supplier payment could not be cancelled");
  return changed;
}
module.exports = {
  options,
  summary,
  list,
  create,
  find,
  submit,
  decide,
  addQuotation,
  createOrder,
  receive,
  pay,
  requestPayment,
  decidePayment,
  cancelPayment,
};
