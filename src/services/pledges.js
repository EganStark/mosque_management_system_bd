const db = require("../config/db");
const periods = require("./accounting-periods");
const paymentGuards = require("./payment-guards");

async function refreshOverdue() {
  await db("donation_pledges")
    .whereIn("status", ["active", "partial"])
    .whereNotNull("due_date")
    .where("due_date", "<", db.fn.now())
    .update({ status: "overdue", updated_at: db.fn.now() });
}
async function list({ status } = {}) {
  const q = db("donation_pledges as p")
    .leftJoin("members as m", "p.member_id", "m.id")
    .leftJoin("collection_categories as c", "p.collection_category_id", "c.id")
    .select("p.*", "m.id_no as member_no", "c.name as category_name")
    .orderBy("p.pledge_date", "desc")
    .orderBy("p.id", "desc");
  if (
    status &&
    ["active", "partial", "overdue", "paid", "cancelled"].includes(status)
  )
    q.where("p.status", status);
  return q;
}
async function summary() {
  const r = await db("donation_pledges")
    .whereNot({ status: "cancelled" })
    .first(
      db.raw(
        "COUNT(*) FILTER(WHERE status IN ('active','partial','overdue'))::int as open",
      ),
      db.raw("COUNT(*) FILTER(WHERE status='overdue')::int as overdue"),
      db.raw("COALESCE(SUM(pledged_amount),0) as pledged"),
      db.raw("COALESCE(SUM(paid_amount),0) as paid"),
      db.raw(
        "COALESCE(SUM(pledged_amount-paid_amount) FILTER(WHERE status IN ('active','partial','overdue')),0) as due",
      ),
    );
  return Object.fromEntries(
    Object.entries(r).map(([k, v]) => [k, Number(v || 0)]),
  );
}
async function create(data, userId) {
  const seq = await db.raw("SELECT nextval('donation_pledge_no_seq') as value");
  const [r] = await db("donation_pledges")
    .insert({
      pledge_no: `PLG-${new Date().getFullYear()}-${String(seq.rows[0].value).padStart(6, "0")}`,
      member_id: data.member_id || null,
      donor_name: data.donor_name,
      phone: data.phone || null,
      collection_category_id: data.collection_category_id || null,
      purpose: data.purpose,
      pledged_amount: data.pledged_amount,
      pledge_date: data.pledge_date,
      due_date: data.due_date || null,
      next_follow_up_date: data.next_follow_up_date || null,
      follow_up_notes: data.follow_up_notes || null,
      created_by: userId,
    })
    .returning("*");
  return r;
}
async function find(id) {
  const item = await db("donation_pledges as p")
    .leftJoin("members as m", "p.member_id", "m.id")
    .leftJoin("collection_categories as c", "p.collection_category_id", "c.id")
    .select("p.*", "m.id_no as member_no", "c.name as category_name")
    .where("p.id", id)
    .first();
  if (!item) return null;
  item.payments = await db("pledge_payments as pp")
    .join("collections as c", "pp.collection_id", "c.id")
    .leftJoin("users as u", "pp.received_by", "u.id")
    .select(
      "pp.*",
      "c.receipt_no",
      "c.payment_method",
      "c.transaction_reference",
      "u.name as received_by_name",
    )
    .where("pp.pledge_id", id)
    .orderBy("pp.payment_date", "desc");
  return item;
}
async function pay(id, data, userId) {
  return db.transaction(async (trx) => {
    await periods.assertOpen(data.payment_date, trx);
    const bankId = await paymentGuards.bankIdFor(data, trx);
    const walletId = await paymentGuards.walletIdFor(data, trx);
    const p = await trx("donation_pledges").where({ id }).forUpdate().first();
    if (!p || !["active", "partial", "overdue"].includes(p.status))
      throw new Error("এই অঙ্গীকারে টাকা গ্রহণ করা যাবে না");
    const amount = Number(data.amount),
      due = Number(p.pledged_amount) - Number(p.paid_amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > due)
      throw new Error("পরিমাণটি বকেয়ার সীমার মধ্যে দিন");
    if (data.payment_method === "bank" && !data.bank_id)
      throw new Error("ব্যাংক হিসাব নির্বাচন করুন");
    const seq = await trx.raw(
      "SELECT nextval('collection_receipt_seq') as value",
    );
    const [c] = await trx("collections")
      .insert({
        member_id: p.member_id,
        payer_name: p.donor_name,
        collection_category_id: p.collection_category_id,
        purpose: `Pledge ${p.pledge_no}: ${p.purpose}`,
        receipt_no: `RCPT-${new Date().getFullYear()}-${String(seq.rows[0].value).padStart(6, "0")}`,
        payment_method: data.payment_method,
        bank_id: bankId,
        mobile_wallet_id: walletId,
        transaction_reference: data.transaction_reference || null,
        remarks: data.remarks || null,
        amount,
        date: data.payment_date,
        status: "posted",
        created_by: userId,
      })
      .returning("*");
    await trx("pledge_payments").insert({
      pledge_id: id,
      collection_id: c.id,
      amount,
      payment_date: data.payment_date,
      received_by: userId,
    });
    const paid = Number(p.paid_amount) + amount;
    await trx("donation_pledges")
      .where({ id })
      .update({
        paid_amount: paid,
        status: paid >= Number(p.pledged_amount) ? "paid" : "partial",
        updated_at: trx.fn.now(),
      });
    return c;
  });
}
async function followUp(id, data) {
  return db("donation_pledges")
    .where({ id })
    .update({
      follow_up_status: data.follow_up_status,
      last_contact_date: data.last_contact_date || null,
      next_follow_up_date: data.next_follow_up_date || null,
      follow_up_notes: data.follow_up_notes || null,
      updated_at: db.fn.now(),
    });
}
module.exports = { refreshOverdue, list, summary, create, find, pay, followUp };
