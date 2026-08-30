const db = require("../config/db");
const periods = require("./accounting-periods");
const paymentGuards = require("./payment-guards");
const { assertIndependentApproval } = require('./approval-separation');
const expenses = require('./expenses');
const monthDate = (value) =>
  /^\d{4}-\d{2}$/.test(String(value || "")) ? `${value}-01` : null;
async function staffList() {
  return db("staff_members")
    .where({ is_active: true })
    .whereNot({ employment_status: "left" })
    .select(
      "id",
      "name_bn",
      "position_bn",
      "phone",
      "basic_salary",
      "monthly_allowance",
    )
    .orderBy("sort_order");
}
async function overview(month) {
  const payrollMonth = monthDate(month);
  const staff = await staffList();
  const payrollQ = db("staff_payrolls as p")
    .join("staff_members as s", "p.staff_id", "s.id")
    .select("p.*", "s.name_bn", "s.position_bn");
  if (payrollMonth) payrollQ.where("p.payroll_month", payrollMonth);
  const payrolls = await payrollQ.orderBy("s.sort_order");
  const summary = payrolls.reduce(
    (a, p) => ({
      payable: a.payable + Number(p.net_payable),
      paid: a.paid + Number(p.amount_paid),
      unpaid: a.unpaid + (Number(p.net_payable) - Number(p.amount_paid)),
    }),
    { payable: 0, paid: 0, unpaid: 0 },
  );
  return { staff, payrolls, summary };
}
async function saveRoster(staffId, data) {
  return (
    await db("staff_duty_rosters")
      .insert({
        staff_id: staffId,
        day_of_week: data.day_of_week,
        start_time: data.start_time,
        end_time: data.end_time,
        duty_name: data.duty_name,
        location: data.location || null,
      })
      .returning("*")
  )[0];
}
async function rosters() {
  return db("staff_duty_rosters as r")
    .join("staff_members as s", "r.staff_id", "s.id")
    .select("r.*", "s.name_bn", "s.position_bn")
    .where("r.is_active", true)
    .orderBy("r.day_of_week")
    .orderBy("r.start_time");
}
async function attendanceSheet(date) {
  return db("staff_members as s")
    .leftJoin("staff_attendance as a", function () {
      this.on("a.staff_id", "=", "s.id").andOn(
        "a.attendance_date",
        "=",
        db.raw("?", [date]),
      );
    })
    .select(
      "s.id",
      "s.name_bn",
      "s.position_bn",
      "a.status as attendance_status",
      "a.check_in",
      "a.check_out",
      "a.remarks",
    )
    .where({ "s.is_active": true })
    .whereNot("s.employment_status", "left")
    .orderBy("s.sort_order");
}
async function saveAttendance(date, rows, userId) {
  return db.transaction(async (trx) => {
    const allowed = new Set(
      (
        await trx("staff_members")
          .where({ is_active: true })
          .whereIn(
            "id",
            rows.map((r) => r.staff_id),
          )
          .pluck("id")
      ).map(Number),
    );
    for (const row of rows.filter((r) => allowed.has(Number(r.staff_id))))
      await trx("staff_attendance")
        .insert({
          staff_id: row.staff_id,
          attendance_date: date,
          status: row.status,
          check_in: row.check_in || null,
          check_out: row.check_out || null,
          remarks: row.remarks || null,
          recorded_by: userId,
        })
        .onConflict(["staff_id", "attendance_date"])
        .merge([
          "status",
          "check_in",
          "check_out",
          "remarks",
          "recorded_by",
          "updated_at",
        ]);
  });
}
async function generatePayroll(month, userId) {
  const date = monthDate(month);
  if (!date) throw new Error("Invalid payroll month");
  const staff = await staffList();
  const rows = staff
    .filter(
      (s) => Number(s.basic_salary) > 0 || Number(s.monthly_allowance) > 0,
    )
    .map((s) => ({
      staff_id: s.id,
      payroll_month: date,
      basic_salary: s.basic_salary || 0,
      allowances: s.monthly_allowance || 0,
      deductions: 0,
      net_payable:
        Number(s.basic_salary || 0) + Number(s.monthly_allowance || 0),
      generated_by: userId,
    }));
  if (!rows.length) return 0;
  return (
    await db("staff_payrolls")
      .insert(rows)
      .onConflict(["staff_id", "payroll_month"])
      .ignore()
      .returning("id")
  ).length;
}
async function findPayroll(id) {
  const item = await db("staff_payrolls as p")
    .join("staff_members as s", "p.staff_id", "s.id")
    .select("p.*", "s.name_bn", "s.position_bn", "s.phone")
    .where("p.id", id)
    .first();
  if (!item) return null;
  item.payments = await db("staff_payroll_payments as pp")
    .leftJoin("users as u", "pp.paid_by", "u.id")
    .select("pp.*", "u.name as paid_by_name")
    .where("pp.payroll_id", id)
    .orderBy("pp.payment_date", "desc");
  item.paymentRequests = await db("staff_payroll_payment_requests as r").leftJoin("users as requester", "r.requested_by", "requester.id").leftJoin("users as decider", "r.decided_by", "decider.id").select("r.*", "requester.name as requester_name", "decider.name as decider_name").where("r.payroll_id", id).orderBy("r.requested_at", "desc");
  return item;
}
async function adjustPayroll(id, data) {
  const item = await db("staff_payrolls").where({ id }).first();
  if (!item || item.status === "paid")
    throw new Error("Paid payroll cannot be adjusted");
  const allowances = Number(data.allowances || 0),
    deductions = Number(data.deductions || 0),
    net = Number(item.basic_salary) + allowances - deductions;
  if (net < 0) throw new Error("Deductions cannot exceed salary");
  await db("staff_payrolls")
    .where({ id })
    .update({
      allowances,
      deductions,
      net_payable: net,
      notes: data.notes || null,
      updated_at: db.fn.now(),
    });
}
async function pay(id, data, userId, connection = null) {
  const execute = async (trx) => {
    await periods.assertOpen(data.payment_date, trx);
    const bankId = await paymentGuards.bankIdFor(data, trx);
    const walletId = await paymentGuards.walletIdFor(data, trx);
    const item = await trx("staff_payrolls as p")
      .join("staff_members as s", "p.staff_id", "s.id")
      .select("p.*", "s.name_bn")
      .where("p.id", id)
      .forUpdate()
      .first();
    if (!item) throw new Error("Payroll not found");
    const amount = Number(data.amount),
      due = Number(item.net_payable) - Number(item.amount_paid);
    if (!Number.isFinite(amount) || amount <= 0 || amount > due)
      throw new Error("Payment must be within payroll balance");
    await paymentGuards.assertOutgoingFunds({
      payment_method: data.payment_method,
      bank_id: bankId,
      mobile_wallet_id: walletId,
      date: data.payment_date,
    }, amount, trx);
    const head = await trx("expense_heads")
      .where({ name: "স্টাফ বেতন ও ভাতা" })
      .first();
    if (!head) throw new Error("Payroll expense head is missing");
    const budgetPosition = await expenses.budgetPosition({ expense_head_id: head.id, date: data.payment_date, amount }, trx);
    const budgetOverrideReason = String(data.budget_override_reason || '').trim();
    if (budgetPosition?.exceeds && !budgetOverrideReason) throw new Error(`Payroll payment exceeds its budget line by ${(budgetPosition.spent + budgetPosition.requested - budgetPosition.budget).toFixed(2)}; enter an override reason`);
    const seq = await trx.raw("SELECT nextval('expense_voucher_seq') as value");
    const [expense] = await trx("expenses")
      .insert({
        expense_head_id: head.id,
        purpose: `Staff payroll ${String(item.payroll_month).slice(0, 7)}`,
        amount,
        date: data.payment_date,
        voucher_no: `VCHR-${new Date().getFullYear()}-${String(seq.rows[0].value).padStart(6, "0")}`,
        payee: item.name_bn,
          payment_method: data.payment_method,
          bank_id: bankId,
          mobile_wallet_id: walletId,
        transaction_reference: data.reference || null,
        remarks: data.remarks || null,
        status: "posted",
        created_by: userId,
        budget_amount_at_approval: budgetPosition ? budgetPosition.budget : null,
        budget_spent_before: budgetPosition ? budgetPosition.spent : null,
        budget_override_reason: budgetPosition?.exceeds ? budgetOverrideReason : null,
      })
      .returning("*");
    const [payment] = await trx("staff_payroll_payments").insert({
      payroll_id: id,
      expense_id: expense.id,
      amount,
      payment_date: data.payment_date,
      payment_method: data.payment_method,
      reference: data.reference || null,
      remarks: data.remarks || null,
      paid_by: userId,
    }).returning("*");
    const paid = Number(item.amount_paid) + amount;
    await trx("staff_payrolls")
      .where({ id })
      .update({
        amount_paid: paid,
        status: paid >= Number(item.net_payable) ? "paid" : "partial",
        updated_at: trx.fn.now(),
      });
    return payment;
  };
  return connection ? execute(connection) : db.transaction(execute);
}
async function requestPayment(id, data, userId) {
  return db.transaction(async (trx) => {
    await periods.assertOpen(data.payment_date, trx);
    const bankId = await paymentGuards.bankIdFor(data, trx), walletId = await paymentGuards.walletIdFor(data, trx);
    const payroll = await trx("staff_payrolls").where({ id }).forUpdate().first();
    if (!payroll) throw new Error("Payroll not found");
    const reserved = Number((await trx("staff_payroll_payment_requests").where({ payroll_id: id }).whereIn("status", ["pending", "processing"]).sum("amount as total").first()).total || 0);
    const amount = Number(data.amount), due = Number(payroll.net_payable) - Number(payroll.amount_paid) - reserved;
    if (!Number.isFinite(amount) || amount <= 0 || amount > due) throw new Error("Payment exceeds the unreserved payroll balance");
    return (await trx("staff_payroll_payment_requests").insert({ payroll_id: id, amount, payment_date: data.payment_date, payment_method: data.payment_method, bank_id: bankId, mobile_wallet_id: walletId, reference: data.reference || null, remarks: data.remarks || null, requested_by: userId }).returning("*"))[0];
  });
}
async function decidePayment(requestId, decision, notes, userId, options = {}) {
  if (!["approved", "rejected"].includes(decision)) throw new Error("Invalid payroll payment decision");
  return db.transaction(async (trx) => {
    const request = await trx("staff_payroll_payment_requests").where({ id: requestId }).forUpdate().first();
    if (!request || request.status !== "pending") throw new Error("This payroll payment request has already been decided");
    if (decision === "rejected") {
      await trx("staff_payroll_payment_requests").where({ id: requestId }).update({ status: "rejected", decided_by: userId, decided_at: trx.fn.now(), decision_notes: notes || null });
      return null;
    }
    await assertIndependentApproval(trx, request.requested_by, userId, 'payroll payment');
    const payment = await pay(request.payroll_id, { ...request, budget_override_reason: options.budget_override_reason }, userId, trx);
    await trx("staff_payroll_payment_requests").where({ id: requestId }).update({ status: "approved", payroll_payment_id: payment.id, decided_by: userId, decided_at: trx.fn.now(), decision_notes: notes || null });
    return payment;
  });
}
module.exports = {
  staffList,
  overview,
  saveRoster,
  rosters,
  attendanceSheet,
  saveAttendance,
  generatePayroll,
  findPayroll,
  adjustPayroll,
  pay,
  requestPayment,
  decidePayment,
};
