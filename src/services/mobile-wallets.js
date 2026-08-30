const db = require("../config/db");
const periods = require("./accounting-periods");

const PROVIDERS = ["bkash", "nagad", "rocket", "other"];

function validate(data) {
  const provider = String(data.provider || "").trim();
  const name = String(data.name || "").trim();
  const openingBalance = Number(data.opening_balance || 0);
  if (!PROVIDERS.includes(provider)) throw new Error("Select a valid wallet provider");
  if (!name) throw new Error("Wallet name is required");
  if (!Number.isFinite(openingBalance) || openingBalance < 0)
    throw new Error("Opening balance cannot be negative");
  if (openingBalance > 0 && !data.opening_balance_date)
    throw new Error("Opening balance date is required");
  return {
    provider,
    name,
    account_number: data.account_number || null,
    opening_balance: openingBalance,
    opening_balance_date: data.opening_balance_date || null,
  };
}

async function duplicateAccount(connection, data, exceptId) {
  if (!data.account_number) return null;
  const query = connection("mobile_wallets")
    .where({ provider: data.provider })
    .whereRaw("LOWER(account_number)=LOWER(?)", [String(data.account_number).trim()]);
  if (exceptId) query.whereNot({ id: exceptId });
  return query.first();
}

const wallets = {
  all: () => db("mobile_wallets").orderBy("provider").orderBy("name"),
  active: () =>
    db("mobile_wallets")
      .where({ is_active: true })
      .orderBy("provider")
      .orderBy("name"),
  find: (id) => db("mobile_wallets").where({ id }).first(),
  create: async (data) =>
    db.transaction(async (trx) => {
      const payload = validate(data);
      if (payload.opening_balance_date)
        await periods.assertOpen(payload.opening_balance_date, trx);
      if (await duplicateAccount(trx, payload))
        throw new Error("This provider account number already exists");
      return (
        await trx("mobile_wallets")
          .insert({ ...payload, is_active: true })
          .returning("*")
      )[0];
    }),
  update: async (id, data) =>
    db.transaction(async (trx) => {
      const current = await trx("mobile_wallets").where({ id }).forUpdate().first();
      if (!current) throw new Error("Mobile wallet not found");
      const payload = validate(data);
      if (await duplicateAccount(trx, payload, id))
        throw new Error("This provider account number already exists");
      const openingChanged =
        Number(current.opening_balance || 0) !== payload.opening_balance ||
        String(current.opening_balance_date || "").slice(0, 10) !==
          String(payload.opening_balance_date || "").slice(0, 10);
      if (openingChanged) {
        const checks = [
          trx("collections").where({ mobile_wallet_id: id }),
          trx("expenses").where({ mobile_wallet_id: id }),
          trx("mosque_loans").where({ mobile_wallet_id: id }),
          trx("loan_repayments").where({ mobile_wallet_id: id }),
          trx("treasury_transfers").where((query) =>
            query
              .where({ from_mobile_wallet_id: id })
              .orWhere({ to_mobile_wallet_id: id }),
          ),
        ];
        for (const check of checks) {
          if (await check.first())
            throw new Error(
              "Opening balance cannot change after financial activity begins",
            );
        }
        if (payload.opening_balance_date)
          await periods.assertOpen(payload.opening_balance_date, trx);
      }
      await trx("mobile_wallets")
        .where({ id })
        .update({ ...payload, updated_at: trx.fn.now() });
      return trx("mobile_wallets").where({ id }).first();
    }),
  setActive: async (id, active) =>
    db.transaction(async (trx) => {
      const current = await trx("mobile_wallets").where({ id }).forUpdate().first();
      if (!current) throw new Error("Mobile wallet not found");
      if (!active) {
        const treasury = require("./treasury");
        const balance = await treasury.mobileWalletBalance(id, null, trx);
        if (Math.abs(balance) > 0.0001)
          throw new Error(
            "Move or settle the wallet balance before deactivating this account",
          );
      }
      await trx("mobile_wallets")
        .where({ id })
        .update({ is_active: Boolean(active), updated_at: trx.fn.now() });
    }),
};

module.exports = { wallets, PROVIDERS };
