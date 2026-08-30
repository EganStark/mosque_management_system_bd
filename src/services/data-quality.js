const db = require("../config/db");
const treasury = require("./treasury");
const periods = require("./accounting-periods");

async function repairCollectionAccount(id, data) {
  return db.transaction(async (trx) => {
    const collection = await trx("collections").where({ id }).forUpdate().first();
    if (!collection || collection.status !== "posted")
      throw new Error("Posted collection not found");
    await periods.assertOpen(collection.date, trx);
    if (collection.payment_method === "bank") {
      if (collection.bank_id) throw new Error("Collection already has a bank account");
      const bankId = Number(data.bank_id);
      const bank = Number.isInteger(bankId)
        ? await trx("banks").where({ id: bankId, is_active: true }).first()
        : null;
      if (!bank) throw new Error("Select an active bank account");
      await trx("collections").where({ id }).update({
        bank_id: bank.id,
        mobile_wallet_id: null,
        updated_at: trx.fn.now(),
      });
      return bank;
    }
    if (collection.payment_method === "mobile_banking") {
      if (collection.mobile_wallet_id)
        throw new Error("Collection already has a mobile wallet");
      const walletId = Number(data.mobile_wallet_id);
      const wallet = Number.isInteger(walletId)
        ? await trx("mobile_wallets").where({ id: walletId, is_active: true }).first()
        : null;
      if (!wallet) throw new Error("Select an active mobile wallet");
      const submission = await trx("online_donation_submissions")
        .where({ collection_id: collection.id })
        .first();
      if (
        submission &&
        ["bkash", "nagad", "rocket"].includes(submission.payment_method) &&
        wallet.provider !== submission.payment_method
      )
        throw new Error("Selected wallet does not match the donation provider");
      await trx("collections").where({ id }).update({
        mobile_wallet_id: wallet.id,
        bank_id: null,
        updated_at: trx.fn.now(),
      });
      return wallet;
    }
    throw new Error("This collection does not require an account repair");
  });
}

async function audit() {
  const [
    duplicatePhones,
    missingPhones,
    incompleteSubscriptions,
    uncategorizedCollections,
    uncategorizedExpenses,
    bankCollections,
    bankExpenses,
    walletCollections,
    walletExpenses,
    walletLoans,
    walletRepayments,
    mismatchedPaymentAccounts,
    inconsistentLoans,
    cancelledLoansWithRepayments,
    duplicateReferences,
    negativeStock,
    incompleteAssets,
    staleDocuments,
    reconciliationResult,
  ] = await Promise.all([
    db("members").where({ status: "active" }).whereNotNull("phone")
      .whereRaw("regexp_replace(phone,'[^0-9]','','g') <> ''")
      .select(db.raw("regexp_replace(phone,'[^0-9]','','g') normalized_phone"), db.raw("COUNT(*)::int count"), db.raw("string_agg(name, ', ' ORDER BY name) names"))
      .groupByRaw("regexp_replace(phone,'[^0-9]','','g')").havingRaw("COUNT(*) > 1").orderBy("count", "desc").limit(20),
    db("members").where({ status: "active" }).where((q) => q.whereNull("phone").orWhereRaw("btrim(phone)=''")).select("id", "id_no", "name").limit(30),
    db("members").where({ status: "active", monthly_payment: true }).where("monthly_payment_amount", "<=", 0).select("id", "id_no", "name").limit(30),
    db("collections").where({ status: "posted" }).whereNull("collection_category_id").select("id", "receipt_no", "purpose", "amount").orderBy("date", "desc").limit(30),
    db("expenses").where({ status: "posted" }).whereNull("expense_head_id").select("id", "voucher_no", "purpose", "amount").orderBy("date", "desc").limit(30),
    db("collections").where({ status: "posted", payment_method: "bank" }).whereNull("bank_id").select("id", "receipt_no", "purpose", "amount").limit(30),
    db("expenses").where({ status: "posted", payment_method: "bank" }).whereNull("bank_id").select("id", "voucher_no", "purpose", "amount").limit(30),
    db("collections").where({ status: "posted", payment_method: "mobile_banking" }).whereNull("mobile_wallet_id").select("id", "receipt_no", "purpose", "amount").limit(30),
    db("expenses").where({ status: "posted", payment_method: "mobile_banking" }).whereNull("mobile_wallet_id").select("id", "voucher_no", "purpose", "amount").limit(30),
    db("mosque_loans").whereNot({ status: "cancelled" }).where({ payment_method: "mobile_banking" }).whereNull("mobile_wallet_id").select("id", "loan_no", "borrower_name as name", "principal_amount as amount").limit(30),
    db("loan_repayments as r").join("mosque_loans as l", "r.loan_id", "l.id").where({ "r.payment_method": "mobile_banking", "r.status": "posted" }).whereNull("r.mobile_wallet_id").select("r.id", "l.loan_no", "l.borrower_name as name", "r.amount").limit(30),
    db.raw(`
      SELECT id, reference_no, description, amount FROM (
        SELECT id, receipt_no AS reference_no, purpose AS description, amount FROM collections
          WHERE status='posted' AND ((payment_method='cash' AND (bank_id IS NOT NULL OR mobile_wallet_id IS NOT NULL))
            OR (payment_method='bank' AND mobile_wallet_id IS NOT NULL)
            OR (payment_method='mobile_banking' AND bank_id IS NOT NULL))
        UNION ALL
        SELECT id, voucher_no, purpose, amount FROM expenses
          WHERE status='posted' AND ((payment_method='cash' AND (bank_id IS NOT NULL OR mobile_wallet_id IS NOT NULL))
            OR (payment_method='bank' AND mobile_wallet_id IS NOT NULL)
            OR (payment_method='mobile_banking' AND bank_id IS NOT NULL))
      ) records LIMIT 30
    `),
    db.raw(`
      SELECT l.id,l.loan_no,l.borrower_name AS name,l.repaid_amount AS amount,
        COALESCE(SUM(r.amount),0) AS payment_total
      FROM mosque_loans l LEFT JOIN loan_repayments r ON r.loan_id=l.id AND r.status='posted'
      GROUP BY l.id
      HAVING l.repaid_amount <> COALESCE(SUM(r.amount),0)
        OR (l.status='paid' AND l.repaid_amount < l.principal_amount)
        OR (l.status IN ('active','overdue') AND l.repaid_amount >= l.principal_amount)
      LIMIT 30
    `),
    db("mosque_loans as l").join("loan_repayments as r", "l.id", "r.loan_id").where({ "l.status": "cancelled", "r.status": "posted" })
      .select("l.id", "l.loan_no", "l.borrower_name as name").sum("r.amount as amount").groupBy("l.id").limit(30),
    db("collections").where({ status: "posted" }).whereNotNull("transaction_reference").whereRaw("btrim(transaction_reference)<>''")
      .select("transaction_reference").count("* as count").groupBy("transaction_reference").havingRaw("COUNT(*) > 1").limit(20),
    db("inventory_items").where("stock_quantity", "<", 0).select("id", "item_code", "name", "stock_quantity").limit(30),
    db("assets").where({ status: "active" }).where((q) => q.whereNull("category_id").orWhereNull("location").orWhereRaw("btrim(location)=''"))
      .select("id", "asset_code", "name", "location").limit(30),
    db("document_records").where({ status: "pending" }).where("updated_at", "<", db.raw("CURRENT_DATE - INTERVAL '7 days'"))
      .select("id", "reference_no", "title", "updated_at").limit(30),
    db.raw("SELECT DISTINCT ON (r.bank_id) r.id,b.name,r.statement_date,r.difference FROM bank_reconciliations r JOIN banks b ON b.id=r.bank_id WHERE b.is_active=true ORDER BY r.bank_id,r.statement_date DESC,r.id DESC"),
  ]);

  const wallets = await db("mobile_wallets").where({ is_active: true }).select("id", "name", "account_number");
  const negativeWallets = [];
  for (const wallet of wallets) {
    const balance = await treasury.mobileWalletBalance(wallet.id);
    if (balance < 0) negativeWallets.push({ ...wallet, amount: balance });
  }

  const issues = [];
  const add = (key, title, titleEn, severity, href, items, detail) => {
    const rows = items?.rows || items || [];
    if (rows.length) issues.push({ key, title, titleEn, severity, href, items: rows, count: rows.length, detail });
  };
  add("duplicate-phones", "একই মোবাইলে একাধিক সদস্য", "Duplicate member phones", "danger", "/members", duplicatePhones, "সদস্য পরিচয় যাচাই করুন");
  add("missing-phones", "সক্রিয় সদস্যের মোবাইল নেই", "Missing member phones", "warning", "/members", missingPhones, "যোগাযোগের তথ্য পূরণ করুন");
  add("subscription-amount", "চাঁদার পরিমাণ নির্ধারিত নয়", "Invalid subscription amounts", "warning", "/members", incompleteSubscriptions, "মাসিক চাঁদার পরিমাণ শূন্য");
  add("collection-category", "খাতবিহীন আদায়", "Uncategorized collections", "danger", "/collections", uncategorizedCollections, "আদায়ের খাত নির্বাচন করুন");
  add("expense-head", "খাতবিহীন খরচ", "Uncategorized expenses", "danger", "/expenses", uncategorizedExpenses, "খরচের খাত নির্বাচন করুন");
  add("collection-bank", "ব্যাংক হিসাববিহীন আদায়", "Collections missing bank account", "danger", "/collections", bankCollections, "ব্যাংক পেমেন্টে হিসাব নির্বাচন হয়নি");
  add("expense-bank", "ব্যাংক হিসাববিহীন খরচ", "Expenses missing bank account", "danger", "/expenses", bankExpenses, "ব্যাংক পেমেন্টে হিসাব নির্বাচন হয়নি");
  add("collection-wallet", "ওয়ালেটবিহীন মোবাইল আদায়", "Collections missing mobile wallet", "danger", "/collections", walletCollections, "মোবাইল পেমেন্টে গ্রহণকারী ওয়ালেট নির্বাচন হয়নি");
  add("expense-wallet", "ওয়ালেটবিহীন মোবাইল খরচ", "Expenses missing mobile wallet", "danger", "/expenses", walletExpenses, "মোবাইল খরচে প্রেরণকারী ওয়ালেট নির্বাচন হয়নি");
  add("loan-wallet", "ওয়ালেটবিহীন মোবাইল ঋণ", "Loans missing mobile wallet", "danger", "/loans", walletLoans, "মোবাইল ব্যাংকিং ঋণের ওয়ালেট অনুপস্থিত");
  add("repayment-wallet", "ওয়ালেটবিহীন মোবাইল কিস্তি", "Repayments missing mobile wallet", "danger", "/loans", walletRepayments, "মোবাইল কিস্তির গ্রহণকারী ওয়ালেট অনুপস্থিত");
  add("payment-account-mismatch", "পেমেন্ট পদ্ধতি ও হিসাবের অমিল", "Payment method/account mismatch", "danger", "/data-quality", mismatchedPaymentAccounts, "নগদ, ব্যাংক বা ওয়ালেট পদ্ধতির সঙ্গে ভুল হিসাব যুক্ত");
  add("loan-ledger-mismatch", "ঋণ ও কিস্তি লেজারে অমিল", "Loan repayment ledger mismatch", "danger", "/loans", inconsistentLoans, "সংরক্ষিত আদায় এবং কিস্তির যোগফল বা ঋণের অবস্থা মিলছে না");
  add("cancelled-loan-payment", "বাতিল ঋণে কিস্তি রয়েছে", "Cancelled loans with repayments", "danger", "/loans?status=cancelled", cancelledLoansWithRepayments, "বাতিল ঋণে কোনো কিস্তি থাকা উচিত নয়");
  add("negative-wallet", "ঋণাত্মক মোবাইল ওয়ালেট ব্যালেন্স", "Negative mobile wallet balance", "danger", "/treasury", negativeWallets, "ওয়ালেট লেনদেন ও প্রারম্ভিক ব্যালেন্স যাচাই করুন");
  add("duplicate-reference", "পুনরাবৃত্ত লেনদেন রেফারেন্স", "Duplicate transaction references", "danger", "/collections", duplicateReferences, "সম্ভাব্য ডুপ্লিকেট আদায় যাচাই করুন");
  add("negative-stock", "ঋণাত্মক মজুত", "Negative inventory", "danger", "/inventory", negativeStock, "স্টক সমন্বয় প্রয়োজন");
  add("asset-details", "সম্পদের শ্রেণি বা অবস্থান অসম্পূর্ণ", "Incomplete asset details", "warning", "/assets", incompleteAssets, "সক্রিয় সম্পদের তথ্য পূরণ করুন");
  add("stale-documents", "দীর্ঘদিন অপেক্ষমাণ নথি", "Stale document approvals", "warning", "/documents?status=pending", staleDocuments, "৭ দিনের বেশি সময় ধরে অপেক্ষমাণ");
  add("bank-difference", "সর্বশেষ ব্যাংক মিলে পার্থক্য", "Bank reconciliation differences", "danger", "/treasury", reconciliationResult.rows.filter((row) => Number(row.difference) !== 0), "স্টেটমেন্ট ও সিস্টেম ব্যালেন্স মেলেনি");
  const penalty = issues.reduce((sum, issue) => sum + Math.min(issue.severity === "danger" ? 25 : 15, issue.count * (issue.severity === "danger" ? 5 : 2)), 0);
  return {
    score: Math.max(0, 100 - penalty),
    issues,
    totalIssues: issues.reduce((sum, issue) => sum + issue.count, 0),
    critical: issues.filter((issue) => issue.severity === "danger").reduce((sum, issue) => sum + issue.count, 0),
    checkedAt: new Date(),
  };
}

module.exports = { audit, repairCollectionAccount };
