async function bankIdFor(
  data,
  connection,
  allowedMethods = ["cash", "bank", "mobile_banking"],
) {
  if (!allowedMethods.includes(data.payment_method))
    throw new Error("Select a valid payment method");
  if (data.payment_method !== "bank") return null;
  const bankId = Number(data.bank_id);
  if (!Number.isInteger(bankId)) throw new Error("Select an active bank account");
  const bank = await connection("banks")
    .where({ id: bankId, is_active: true })
    .first();
  if (!bank) throw new Error("Select an active bank account");
  return bankId;
}

async function walletIdFor(data, connection) {
  if (data.payment_method !== "mobile_banking") return null;
  const walletId = Number(data.mobile_wallet_id);
  if (!Number.isInteger(walletId))
    throw new Error("Select an active mobile wallet");
  const wallet = await connection("mobile_wallets")
    .where({ id: walletId, is_active: true })
    .first();
  if (!wallet) throw new Error("Select an active mobile wallet");
  return walletId;
}

async function assertOutgoingFunds(data, amount, connection) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0)
    throw new Error("Payment amount must be greater than zero");
  if (!["cash", "bank", "mobile_banking"].includes(data.payment_method)) return;
  const fundKey =
    data.payment_method === "bank"
      ? `fund:bank:${data.bank_id}`
      : data.payment_method === "mobile_banking"
        ? `fund:wallet:${data.mobile_wallet_id}`
        : "fund:cash";
  await connection.raw("SELECT pg_advisory_xact_lock(hashtext(?))", [fundKey]);
  const treasury = require("./treasury");
  const available =
    data.payment_method === "bank"
      ? await treasury.bankBalance(data.bank_id, data.date, connection)
      : data.payment_method === "mobile_banking"
        ? await treasury.mobileWalletBalance(
            data.mobile_wallet_id,
            data.date,
            connection,
          )
        : await treasury.cashBalance(data.date, connection);
  if (value > available)
    throw new Error(
      data.payment_method === "bank"
        ? "Insufficient bank balance"
        : data.payment_method === "mobile_banking"
          ? "Insufficient mobile wallet balance"
          : "Insufficient cash balance",
    );
}

module.exports = { bankIdFor, walletIdFor, assertOutgoingFunds };
