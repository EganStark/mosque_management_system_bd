const crypto = require("crypto");
const db = require("../config/db");
const periods = require("./accounting-periods");
function ipHash(ip) {
  return crypto
    .createHash("sha256")
    .update(
      `${process.env.SUBMISSION_HASH_SECRET || process.env.SESSION_SECRET || "dev"}:${ip || ""}`,
    )
    .digest("hex");
}
async function createContact(data, ip) {
  const seq = (
    await db.raw("SELECT nextval('public_contact_ticket_seq') value")
  ).rows[0].value;
  return (
    await db("public_contact_messages")
      .insert({
        ticket_no: `MSG-${new Date().getFullYear()}-${String(seq).padStart(7, "0")}`,
        full_name: data.fullName || data.name,
        email: String(data.email).trim().toLowerCase(),
        phone: data.phone || null,
        subject: data.subject,
        message: data.message,
        source_ip_hash: ipHash(ip),
      })
      .returning("*")
  )[0];
}
async function createDonation(data, ip) {
  const amount = Number(data.amount),
    transactionId = String(data.transactionId || data.tid || "").trim();
  if (!Number.isFinite(amount) || amount <= 0 || amount > 10000000)
    throw new Error("Invalid donation amount");
  if (!transactionId) throw new Error("Transaction ID is required");
  const seq = (
    await db.raw("SELECT nextval('online_donation_confirmation_seq') value")
  ).rows[0].value;
  try {
    return (
      await db("online_donation_submissions")
        .insert({
          confirmation_no: `DON-${new Date().getFullYear()}-${String(seq).padStart(7, "0")}`,
          donation_type: data.donationType || data.type,
          payment_method: data.paymentMethod || data.method,
          amount,
          transaction_id: transactionId,
          donor_name: data.donorName || data.name,
          phone: data.phone,
          email: data.email || null,
          is_anonymous: Boolean(data.isAnonymous ?? data.anon),
          source_ip_hash: ipHash(ip),
        })
        .returning("*")
    )[0];
  } catch (e) {
    if (e.code === "23505")
      throw new Error("This transaction ID has already been submitted");
    throw e;
  }
}
async function summary() {
  const c = await db("public_contact_messages").first(
    db.raw("COUNT(*) FILTER(WHERE status='new')::int new_messages"),
    db.raw("COUNT(*) FILTER(WHERE status='in_progress')::int active_messages"),
  );
  const d = await db("online_donation_submissions").first(
    db.raw("COUNT(*) FILTER(WHERE status='pending')::int pending_donations"),
    db.raw(
      "COALESCE(SUM(amount) FILTER(WHERE status='pending'),0) pending_amount",
    ),
  );
  return {
    newMessages: Number(c.new_messages || 0),
    activeMessages: Number(c.active_messages || 0),
    pendingDonations: Number(d.pending_donations || 0),
    pendingAmount: Number(d.pending_amount || 0),
  };
}
async function contacts() {
  return db("public_contact_messages as m")
    .leftJoin("users as u", "m.assigned_to", "u.id")
    .select("m.*", "u.name as assigned_name")
    .orderByRaw(
      "CASE m.status WHEN 'new' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END",
    )
    .orderBy("m.id", "desc");
}
async function donations() {
  return db("online_donation_submissions as d")
    .leftJoin("collections as c", "d.collection_id", "c.id")
    .leftJoin("banks as b", "c.bank_id", "b.id")
    .leftJoin("mobile_wallets as mw", "c.mobile_wallet_id", "mw.id")
    .select(
      "d.*",
      "c.receipt_no",
      "c.bank_id",
      "c.mobile_wallet_id",
      "b.name as bank_name",
      "b.account_number",
      "mw.name as mobile_wallet_name",
      "mw.account_number as mobile_wallet_number",
    )
    .orderByRaw("CASE d.status WHEN 'pending' THEN 0 ELSE 1 END")
    .orderBy("d.id", "desc");
}
async function users() {
  return db("users")
    .where({ is_active: true })
    .select("id", "name", "role")
    .orderBy("name");
}
async function updateContact(id, data, userId) {
  const status = data.status;
  if (!["new", "in_progress", "resolved", "spam"].includes(status))
    throw new Error("Invalid message status");
  const update = {
    status,
    assigned_to: data.assigned_to || userId,
    response_notes: data.response_notes || null,
    updated_at: db.fn.now(),
    resolved_at: status === "resolved" ? db.fn.now() : null,
  };
  const n = await db("public_contact_messages").where({ id }).update(update);
  if (!n) throw new Error("Message not found");
}
async function reviewDonation(id, decision, reviewData, userId) {
  const data =
    reviewData && typeof reviewData === "object"
      ? reviewData
      : { review_notes: reviewData };
  const notes = data.review_notes || null;
  return db.transaction(async (trx) => {
    const item = await trx("online_donation_submissions")
      .where({ id })
      .forUpdate()
      .first();
    if (!item || item.status !== "pending")
      throw new Error("Donation submission has already been reviewed");
    if (decision === "reject") {
      await trx("online_donation_submissions")
        .where({ id })
        .update({
          status: "rejected",
          review_notes: notes || null,
          reviewed_by: userId,
          reviewed_at: trx.fn.now(),
          updated_at: trx.fn.now(),
        });
      return null;
    }
    if (decision !== "verify") throw new Error("Invalid review decision");
    const collectionDate = new Date().toISOString().slice(0, 10);
    await periods.assertOpen(collectionDate, trx);
    const code =
      {
        general: "general-donation",
        zakat: "zakat",
        monthly: "monthly",
        special: "special-fund",
      }[item.donation_type] || "other";
    const category = await trx("collection_categories").where({ code }).first();
    let bank = null;
    let wallet = null;
    if (item.payment_method === "bank") {
      const bankId = Number(data.bank_id);
      if (Number.isInteger(bankId) && bankId > 0)
        bank = await trx("banks")
          .where({ id: bankId, is_active: true })
          .first();
      if (!bank) throw new Error("Select the bank account that received the donation");
    }
    if (["bkash", "nagad", "rocket"].includes(item.payment_method)) {
      if (data.mobile_wallet_id) {
        const walletId = Number(data.mobile_wallet_id);
        if (Number.isInteger(walletId) && walletId > 0)
          wallet = await trx("mobile_wallets")
            .where({
              id: walletId,
              provider: item.payment_method,
              is_active: true,
            })
            .first();
      } else {
        const matches = await trx("mobile_wallets")
          .where({ provider: item.payment_method, is_active: true });
        if (matches.length === 1) wallet = matches[0];
      }
      if (!wallet)
        throw new Error("Select the matching mobile wallet that received the donation");
    }
    const duplicate = await trx("collections")
      .whereRaw("LOWER(transaction_reference)=LOWER(?)", [item.transaction_id])
      .where({ status: "posted" })
      .first();
    if (duplicate)
      throw new Error("A collection already uses this transaction ID");
    const seq = (
      await trx.raw("SELECT nextval('collection_receipt_seq') value")
    ).rows[0].value;
    const collection = (
      await trx("collections")
        .insert({
          collection_category_id: category?.id || null,
          purpose: `Online donation: ${item.donation_type}`,
          payer_name: item.is_anonymous ? "Anonymous donor" : item.donor_name,
          amount: item.amount,
          date: collectionDate,
          receipt_no: `RCPT-${new Date().getFullYear()}-${String(seq).padStart(6, "0")}`,
          payment_method: ["bkash", "nagad", "rocket"].includes(
            item.payment_method,
          )
            ? "mobile_banking"
            : item.payment_method,
          bank_id: bank?.id || null,
          mobile_wallet_id: wallet?.id || null,
          transaction_reference: item.transaction_id,
          remarks: `Verified online submission ${item.confirmation_no}`,
          status: "posted",
          created_by: userId,
        })
        .returning("*")
    )[0];
    await trx("online_donation_submissions")
      .where({ id })
      .update({
        status: "verified",
        review_notes: notes || null,
        reviewed_by: userId,
        reviewed_at: trx.fn.now(),
        collection_id: collection.id,
        updated_at: trx.fn.now(),
      });
    return collection;
  });
}
module.exports = {
  createContact,
  createDonation,
  summary,
  contacts,
  donations,
  users,
  updateContact,
  reviewDonation,
};
