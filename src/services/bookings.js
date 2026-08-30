const db = require("../config/db");
const periods = require("./accounting-periods");
const paymentGuards = require("./payment-guards");

const facilities = {
  all: () => db("facilities").where({ is_active: true }).orderBy("name"),
};
async function nextNumber(trx = db) {
  const result = await trx.raw(
    "SELECT nextval('facility_booking_no_seq') as value",
  );
  return `BK-${new Date().getFullYear()}-${String(result.rows[0].value).padStart(6, "0")}`;
}
async function list({ from, to, status } = {}) {
  const q = db("facility_bookings as b")
    .join("facilities as f", "b.facility_id", "f.id")
    .leftJoin("members as m", "b.member_id", "m.id")
    .select("b.*", "f.name as facility_name", "m.id_no as member_id_no")
    .orderBy("b.booking_date", "desc")
    .orderBy("b.start_time");
  if (from) q.where("b.booking_date", ">=", from);
  if (to) q.where("b.booking_date", "<=", to);
  if (status) q.where("b.status", status);
  return q;
}
async function summary() {
  const row = await db("facility_bookings").first(
    db.raw(
      "COUNT(*) FILTER (WHERE booking_date=CURRENT_DATE AND status IN ('pending','approved'))::int as today",
    ),
    db.raw("COUNT(*) FILTER (WHERE status='pending')::int as pending"),
    db.raw(
      "COUNT(*) FILTER (WHERE booking_date>=CURRENT_DATE AND status='approved')::int as upcoming",
    ),
    db.raw(
      "COALESCE(SUM(fee_amount-amount_paid) FILTER (WHERE status!='cancelled'),0) as outstanding",
    ),
  );
  return {
    today: Number(row.today || 0),
    pending: Number(row.pending || 0),
    upcoming: Number(row.upcoming || 0),
    outstanding: Number(row.outstanding || 0),
  };
}
async function conflict(data, excludeId, trx = db) {
  const q = trx("facility_bookings")
    .where({ facility_id: data.facility_id, booking_date: data.booking_date })
    .whereIn("status", ["pending", "approved"])
    .where("start_time", "<", data.end_time)
    .where("end_time", ">", data.start_time);
  if (excludeId) q.whereNot({ id: excludeId });
  return q.first();
}
async function create(data, userId) {
  return db.transaction(async (trx) => {
    if (await conflict(data, null, trx))
      throw new Error("Selected facility is already booked during this time");
    const member = data.member_id
      ? await trx("members").where({ id: data.member_id }).first()
      : null;
    const facility = await trx("facilities")
      .where({ id: data.facility_id, is_active: true })
      .first();
    if (!facility) throw new Error("Facility not found");
    const [row] = await trx("facility_bookings")
      .insert({
        facility_id: facility.id,
        member_id: member ? member.id : null,
        booking_no: await nextNumber(trx),
        requester_name: member ? member.name : data.requester_name,
        requester_phone: (member && member.phone) || data.requester_phone,
        booking_type: data.booking_type,
        event_title: data.event_title,
        booking_date: data.booking_date,
        start_time: data.start_time,
        end_time: data.end_time,
        expected_guests: data.expected_guests || null,
        fee_amount: data.fee_amount || facility.default_fee || 0,
        requirements: data.requirements || null,
        notes: data.notes || null,
        created_by: userId,
      })
      .returning("*");
    return row;
  });
}
async function find(id) {
  const item = await db("facility_bookings as b")
    .join("facilities as f", "b.facility_id", "f.id")
    .leftJoin("members as m", "b.member_id", "m.id")
    .select(
      "b.*",
      "f.name as facility_name",
      "f.location as facility_location",
      "m.id_no as member_id_no",
    )
    .where("b.id", id)
    .first();
  if (!item) return null;
  item.payments = await db("facility_booking_payments as p")
    .leftJoin("users as u", "p.received_by", "u.id")
    .select("p.*", "u.name as received_by_name")
    .where("p.booking_id", id)
    .orderBy("p.payment_date", "desc");
  return item;
}
async function setStatus(id, status, userId) {
  const allowed = ["approved", "cancelled", "completed"];
  if (!allowed.includes(status)) throw new Error("Invalid booking status");
  const item = await db("facility_bookings").where({ id }).first();
  if (!item) throw new Error("Booking not found");
  if (status === "approved" && (await conflict(item, id)))
    throw new Error(
      "Another approved or pending booking conflicts with this time",
    );
  const update = { status, updated_at: db.fn.now() };
  if (status === "approved") {
    update.approved_by = userId;
    update.approved_at = db.fn.now();
  }
  await db("facility_bookings").where({ id }).update(update);
}
async function addPayment(id, data, userId) {
  return db.transaction(async (trx) => {
    await periods.assertOpen(data.payment_date, trx);
    const bankId = await paymentGuards.bankIdFor(data, trx);
    const walletId = await paymentGuards.walletIdFor(data, trx);
    const item = await trx("facility_bookings")
      .where({ id })
      .forUpdate()
      .first();
    if (!item) throw new Error("Booking not found");
    const amount = Number(data.amount);
    const due = Number(item.fee_amount) - Number(item.amount_paid);
    if (!Number.isFinite(amount) || amount <= 0 || amount > due)
      throw new Error("Payment must be within outstanding amount");
    const category = await trx("collection_categories")
      .where({ code: "facility-booking" })
      .first();
    const seq = await trx.raw(
      "SELECT nextval('collection_receipt_seq') as value",
    );
    const [collection] = await trx("collections")
      .insert({
        member_id: item.member_id,
        collection_category_id: category ? category.id : null,
        payer_name: item.requester_name,
        purpose: `Facility booking ${item.booking_no}`,
        amount,
        date: data.payment_date,
          payment_method: data.payment_method,
          bank_id: bankId,
          mobile_wallet_id: walletId,
        transaction_reference: data.reference || null,
        receipt_no: `RCPT-${new Date().getFullYear()}-${String(seq.rows[0].value).padStart(6, "0")}`,
        remarks: data.remarks || null,
        status: "posted",
        created_by: userId,
      })
      .returning("*");
    await trx("facility_booking_payments").insert({
      booking_id: id,
      collection_id: collection.id,
      amount,
      payment_date: data.payment_date,
      payment_method: data.payment_method,
      reference: data.reference || null,
      remarks: data.remarks || null,
      received_by: userId,
    });
    const paid = Number(item.amount_paid) + amount;
    await trx("facility_bookings")
      .where({ id })
      .update({
        amount_paid: paid,
        payment_status: paid >= Number(item.fee_amount) ? "paid" : "partial",
        updated_at: trx.fn.now(),
      });
  });
}
module.exports = {
  facilities,
  list,
  summary,
  create,
  find,
  setStatus,
  addPayment,
  conflict,
};
