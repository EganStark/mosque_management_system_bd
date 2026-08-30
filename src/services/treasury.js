const db = require('../config/db');
const periods = require('./accounting-periods');
const { assertIndependentApproval } = require('./approval-separation');

async function sum(table, where, column = 'amount') {
  const row = await db(table).where(where).sum(`${column} as total`).first();
  return Number(row.total || 0);
}

async function cashBalance(upto, connection = db) {
  const cq = connection('collections').where({ status: 'posted', payment_method: 'cash' });
  const eq = connection('expenses').where({ status: 'posted', payment_method: 'cash' });
  const out = connection('treasury_transfers').where({ status: 'posted' }).whereIn('type', ['cash_to_bank', 'cash_to_wallet']);
  const incoming = connection('treasury_transfers').where({ status: 'posted' }).whereIn('type', ['bank_to_cash', 'wallet_to_cash']);
  const loanOut = connection('mosque_loans').whereIn('status', ['active', 'overdue', 'paid']).where({ payment_method: 'cash' });
  const loanIn = connection('loan_repayments').where({ payment_method: 'cash', status: 'posted' });
  if (upto) { cq.where('date', '<=', upto); eq.where('date', '<=', upto); out.where('date', '<=', upto); incoming.where('date', '<=', upto); loanOut.where('issue_date', '<=', upto); loanIn.where('payment_date', '<=', upto); }
  const [c] = await cq.sum('amount as total');
  const [e] = await eq.sum('amount as total');
  const [o] = await out.sum('amount as total');
  const [i] = await incoming.sum('amount as total');
  const [lo] = await loanOut.sum('principal_amount as total');
  const [li] = await loanIn.sum('amount as total');
  return Number(c.total || 0) - Number(e.total || 0) - Number(o.total || 0) + Number(i.total || 0) - Number(lo.total || 0) + Number(li.total || 0);
}

async function bankBalance(bankId, upto, connection = db) {
  const bank = await connection('banks').where({ id: bankId }).first();
  if (!bank) return 0;
  const collectionQ = connection('collections').where({ status: 'posted', payment_method: 'bank', bank_id: bankId });
  const expenseQ = connection('expenses').where({ status: 'posted', payment_method: 'bank', bank_id: bankId });
  const legacyQ = connection('bank_transactions').where({ bank_id: bankId, status: 'posted' });
  const transferQ = connection('treasury_transfers').where({ status: 'posted' }).andWhere((q) => q.where({ from_bank_id: bankId }).orWhere({ to_bank_id: bankId }));
  const loanOutQ = connection('mosque_loans').whereIn('status', ['active', 'overdue', 'paid']).where({ payment_method: 'bank', bank_id: bankId });
  const loanInQ = connection('loan_repayments').where({ payment_method: 'bank', bank_id: bankId, status: 'posted' });
  if (upto) { collectionQ.where('date', '<=', upto); expenseQ.where('date', '<=', upto); legacyQ.where('date', '<=', upto); transferQ.where('date', '<=', upto); loanOutQ.where('issue_date', '<=', upto); loanInQ.where('payment_date', '<=', upto); }
  const collections = await collectionQ.sum('amount as total').first();
  const expenses = await expenseQ.sum('amount as total').first();
  const legacy = await legacyQ.select('type', 'amount');
  const transfers = await transferQ.select('*');
  const loanOut = await loanOutQ.sum('principal_amount as total').first();
  const loanIn = await loanInQ.sum('amount as total').first();
  const includeOpening = !upto || !bank.opening_balance_date || String(bank.opening_balance_date).slice(0, 10) <= upto;
  let balance = (includeOpening ? Number(bank.opening_balance || 0) : 0) + Number(collections.total || 0) - Number(expenses.total || 0);
  legacy.forEach((row) => { balance += row.type === 'deposit' ? Number(row.amount) : -Number(row.amount); });
  transfers.forEach((row) => { if (Number(row.to_bank_id) === Number(bankId)) balance += Number(row.amount); if (Number(row.from_bank_id) === Number(bankId)) balance -= Number(row.amount); });
  balance -= Number(loanOut.total || 0);
  balance += Number(loanIn.total || 0);
  return balance;
}

async function mobileWalletBalance(walletId, upto, connection = db) {
  const wallet = await connection("mobile_wallets").where({ id: walletId }).first();
  if (!wallet) return 0;
  const incomeQ = connection("collections").where({
    status: "posted",
    payment_method: "mobile_banking",
    mobile_wallet_id: walletId,
  });
  const expenseQ = connection("expenses").where({
    status: "posted",
    payment_method: "mobile_banking",
    mobile_wallet_id: walletId,
  });
  const loanOutQ = connection("mosque_loans")
    .whereIn("status", ["active", "overdue", "paid"])
    .where({
      payment_method: "mobile_banking",
      mobile_wallet_id: walletId,
    });
  const loanInQ = connection("loan_repayments").where({
    payment_method: "mobile_banking",
    mobile_wallet_id: walletId,
    status: "posted",
  });
  const transferQ = connection("treasury_transfers")
    .where({ status: "posted" })
    .andWhere((query) =>
      query
        .where({ from_mobile_wallet_id: walletId })
        .orWhere({ to_mobile_wallet_id: walletId }),
    );
  if (upto) {
    incomeQ.where("date", "<=", upto);
    expenseQ.where("date", "<=", upto);
    loanOutQ.where("issue_date", "<=", upto);
    loanInQ.where("payment_date", "<=", upto);
    transferQ.where("date", "<=", upto);
  }
  const income = await incomeQ.sum("amount as total").first();
  const expense = await expenseQ.sum("amount as total").first();
  const loanOut = await loanOutQ.sum("principal_amount as total").first();
  const loanIn = await loanInQ.sum("amount as total").first();
  const transfers = await transferQ.select(
    "from_mobile_wallet_id",
    "to_mobile_wallet_id",
    "amount",
  );
  const includeOpening =
    !upto ||
    !wallet.opening_balance_date ||
    String(wallet.opening_balance_date).slice(0, 10) <= upto;
  let balance =
    (includeOpening ? Number(wallet.opening_balance || 0) : 0) +
    Number(income.total || 0) -
    Number(expense.total || 0) -
    Number(loanOut.total || 0) +
    Number(loanIn.total || 0);
  transfers.forEach((row) => {
    if (Number(row.from_mobile_wallet_id) === Number(walletId))
      balance -= Number(row.amount);
    if (Number(row.to_mobile_wallet_id) === Number(walletId))
      balance += Number(row.amount);
  });
  return balance;
}

async function overview() {
  const bankRows = await db('banks').where({ is_active: true }).orderBy('name');
  const accounts = await Promise.all(bankRows.map(async (bank) => ({ ...bank, balance: await bankBalance(bank.id) })));
  const walletRows = await db("mobile_wallets")
    .orderBy("provider")
    .orderBy("name");
  const walletAccounts = await Promise.all(
    walletRows.map(async (wallet) => ({
      ...wallet,
      balance: await mobileWalletBalance(wallet.id),
    })),
  );
  const cash = await cashBalance();
  const bankTotal = accounts.reduce((s, b) => s + b.balance, 0);
  const walletTotal = walletAccounts
    .filter((wallet) => wallet.is_active)
    .reduce((s, wallet) => s + wallet.balance, 0);
  return { cash, accounts, walletAccounts, bankTotal, walletTotal, total: cash + bankTotal + walletTotal };
}

async function transfers() {
  return db('treasury_transfers as t').leftJoin('banks as fb', 't.from_bank_id', 'fb.id').leftJoin('banks as tb', 't.to_bank_id', 'tb.id')
    .leftJoin('mobile_wallets as fw', 't.from_mobile_wallet_id', 'fw.id').leftJoin('mobile_wallets as tw', 't.to_mobile_wallet_id', 'tw.id')
    .select('t.*', 'fb.name as from_bank_name', 'tb.name as to_bank_name', 'fw.name as from_wallet_name', 'fw.account_number as from_wallet_number', 'tw.name as to_wallet_name', 'tw.account_number as to_wallet_number').orderBy('t.date', 'desc').orderBy('t.id', 'desc');
}

async function createTransfer(data, connection = null) {
  const execute = async (trx) => {
    await periods.assertOpen(data.date, trx);
    const allowed = ['cash_to_bank', 'bank_to_cash', 'bank_to_bank', 'cash_to_wallet', 'wallet_to_cash', 'bank_to_wallet', 'wallet_to_bank', 'wallet_to_wallet'];
    if (!allowed.includes(data.type)) throw new Error('Select a valid transfer type');
    const amount = Number(data.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('Transfer amount must be greater than zero');
    const needsFromBank = ['bank_to_cash', 'bank_to_bank', 'bank_to_wallet'].includes(data.type);
    const needsToBank = ['cash_to_bank', 'bank_to_bank', 'wallet_to_bank'].includes(data.type);
    const needsFromWallet = ['wallet_to_cash', 'wallet_to_bank', 'wallet_to_wallet'].includes(data.type);
    const needsToWallet = ['cash_to_wallet', 'bank_to_wallet', 'wallet_to_wallet'].includes(data.type);
    const fromBankId = Number(data.from_bank_id), toBankId = Number(data.to_bank_id);
    const fromWalletId = Number(data.from_mobile_wallet_id), toWalletId = Number(data.to_mobile_wallet_id);
    const fromBank = needsFromBank && Number.isInteger(fromBankId) ? await trx('banks').where({ id: fromBankId, is_active: true }).first() : null;
    const toBank = needsToBank && Number.isInteger(toBankId) ? await trx('banks').where({ id: toBankId, is_active: true }).first() : null;
    const fromWallet = needsFromWallet && Number.isInteger(fromWalletId) ? await trx('mobile_wallets').where({ id: fromWalletId, is_active: true }).first() : null;
    const toWallet = needsToWallet && Number.isInteger(toWalletId) ? await trx('mobile_wallets').where({ id: toWalletId, is_active: true }).first() : null;
    if (needsFromBank && !fromBank) throw new Error('Select an active source bank');
    if (needsToBank && !toBank) throw new Error('Select an active destination bank');
    if (needsFromWallet && !fromWallet) throw new Error('Select an active source mobile wallet');
    if (needsToWallet && !toWallet) throw new Error('Select an active destination mobile wallet');
    if (data.type === 'bank_to_bank' && fromBank.id === toBank.id) throw new Error('Source and destination banks must differ');
    if (data.type === 'wallet_to_wallet' && fromWallet.id === toWallet.id) throw new Error('Source and destination wallets must differ');
    const sourceKey = needsFromBank ? `fund:bank:${fromBank.id}` : needsFromWallet ? `fund:wallet:${fromWallet.id}` : 'fund:cash';
    await trx.raw('SELECT pg_advisory_xact_lock(hashtext(?))', [sourceKey]);
    const available = needsFromBank ? await bankBalance(fromBank.id, data.date, trx) : needsFromWallet ? await mobileWalletBalance(fromWallet.id, data.date, trx) : await cashBalance(data.date, trx);
    if (amount > available) throw new Error(needsFromBank ? 'Insufficient bank balance' : needsFromWallet ? 'Insufficient mobile wallet balance' : 'Insufficient cash balance');
    const payload = {
      type: data.type,
      from_bank_id: fromBank?.id || null,
      to_bank_id: toBank?.id || null,
      from_mobile_wallet_id: fromWallet?.id || null,
      to_mobile_wallet_id: toWallet?.id || null,
      amount,
      date: data.date,
      reference: data.reference || null,
      remarks: data.remarks || null,
      created_by: data.created_by,
      transfer_request_id: data.transfer_request_id || null,
    };
    return (await trx('treasury_transfers').insert(payload).returning('*'))[0];
  };
  return connection ? execute(connection) : db.transaction(execute);
}

async function transferRequests(status = null) {
  const query = db('treasury_transfer_requests as r').leftJoin('banks as fb', 'r.from_bank_id', 'fb.id').leftJoin('banks as tb', 'r.to_bank_id', 'tb.id').leftJoin('mobile_wallets as fw', 'r.from_mobile_wallet_id', 'fw.id').leftJoin('mobile_wallets as tw', 'r.to_mobile_wallet_id', 'tw.id').leftJoin('users as requester', 'r.requested_by', 'requester.id').leftJoin('users as decider', 'r.decided_by', 'decider.id').select('r.*', 'fb.name as from_bank_name', 'tb.name as to_bank_name', 'fw.name as from_wallet_name', 'tw.name as to_wallet_name', 'requester.name as requester_name', 'decider.name as decider_name').orderBy('r.requested_at', 'desc');
  if (status) query.where('r.status', status);
  return query;
}

async function requestTransfer(data, userId) {
  return db.transaction(async (trx) => {
    await periods.assertOpen(data.date, trx);
    const allowed = ['cash_to_bank', 'bank_to_cash', 'bank_to_bank', 'cash_to_wallet', 'wallet_to_cash', 'bank_to_wallet', 'wallet_to_bank', 'wallet_to_wallet'];
    if (!allowed.includes(data.type)) throw new Error('Select a valid transfer type');
    const amount = Number(data.amount); if (!Number.isFinite(amount) || amount <= 0) throw new Error('Transfer amount must be greater than zero');
    const fromKind = data.type.split('_to_')[0], toKind = data.type.split('_to_')[1];
    const fromBankId = Number(data.from_bank_id), toBankId = Number(data.to_bank_id), fromWalletId = Number(data.from_mobile_wallet_id), toWalletId = Number(data.to_mobile_wallet_id);
    const fromBank = fromKind === 'bank' ? await trx('banks').where({ id: fromBankId, is_active: true }).first() : null;
    const toBank = toKind === 'bank' ? await trx('banks').where({ id: toBankId, is_active: true }).first() : null;
    const fromWallet = fromKind === 'wallet' ? await trx('mobile_wallets').where({ id: fromWalletId, is_active: true }).first() : null;
    const toWallet = toKind === 'wallet' ? await trx('mobile_wallets').where({ id: toWalletId, is_active: true }).first() : null;
    if (fromKind === 'bank' && !fromBank) throw new Error('Select an active source bank'); if (toKind === 'bank' && !toBank) throw new Error('Select an active destination bank');
    if (fromKind === 'wallet' && !fromWallet) throw new Error('Select an active source mobile wallet'); if (toKind === 'wallet' && !toWallet) throw new Error('Select an active destination mobile wallet');
    if (data.type === 'bank_to_bank' && fromBank.id === toBank.id) throw new Error('Source and destination banks must differ'); if (data.type === 'wallet_to_wallet' && fromWallet.id === toWallet.id) throw new Error('Source and destination wallets must differ');
    const key = fromKind === 'bank' ? `fund:bank:${fromBank.id}` : fromKind === 'wallet' ? `fund:wallet:${fromWallet.id}` : 'fund:cash'; await trx.raw('SELECT pg_advisory_xact_lock(hashtext(?))', [key]);
    const available = fromKind === 'bank' ? await bankBalance(fromBank.id, data.date, trx) : fromKind === 'wallet' ? await mobileWalletBalance(fromWallet.id, data.date, trx) : await cashBalance(data.date, trx);
    const reservations = trx('treasury_transfer_requests').whereIn('status', ['pending', 'processing']);
    if (fromKind === 'bank') reservations.where({ from_bank_id: fromBank.id }); else if (fromKind === 'wallet') reservations.where({ from_mobile_wallet_id: fromWallet.id }); else reservations.whereIn('type', ['cash_to_bank', 'cash_to_wallet']);
    const reserved = Number((await reservations.sum('amount as total').first()).total || 0); if (amount > available - reserved) throw new Error('Transfer exceeds the unreserved source balance');
    return (await trx('treasury_transfer_requests').insert({ type: data.type, from_bank_id: fromBank?.id || null, to_bank_id: toBank?.id || null, from_mobile_wallet_id: fromWallet?.id || null, to_mobile_wallet_id: toWallet?.id || null, amount, date: data.date, reference: data.reference || null, remarks: data.remarks || null, requested_by: userId }).returning('*'))[0];
  });
}

async function decideTransfer(requestId, decision, notes, userId) {
  if (!['approved', 'rejected'].includes(decision)) throw new Error('Invalid transfer decision');
  return db.transaction(async (trx) => {
    const request = await trx('treasury_transfer_requests').where({ id: requestId }).forUpdate().first();
    if (!request || request.status !== 'pending') throw new Error('This transfer request has already been decided');
    if (decision === 'rejected') {
      await trx('treasury_transfer_requests').where({ id: requestId }).update({ status: 'rejected', decided_by: userId, decided_at: trx.fn.now(), decision_notes: notes || null });
      return null;
    }
    await assertIndependentApproval(trx, request.requested_by, userId, 'treasury transfer');
    const transfer = await createTransfer({ ...request, created_by: userId, transfer_request_id: request.id }, trx);
    await trx('treasury_transfer_requests').where({ id: requestId }).update({ status: 'approved', transfer_id: transfer.id, decided_by: userId, decided_at: trx.fn.now(), decision_notes: notes || null });
    return transfer;
  });
}

async function cancelTransfer(id, data) {
  return db.transaction(async (trx) => {
    const item = await trx('treasury_transfers').where({ id }).forUpdate().first();
    if (!item || item.status !== 'posted') throw new Error('Active transfer not found');
    await periods.assertOpen(item.date, trx);
    const destination = item.type.endsWith('_bank') ? 'bank' : item.type.endsWith('_wallet') ? 'wallet' : 'cash';
    const destinationId = destination === 'bank' ? item.to_bank_id : destination === 'wallet' ? item.to_mobile_wallet_id : null;
    const key = destination === 'bank' ? `fund:bank:${destinationId}` : destination === 'wallet' ? `fund:wallet:${destinationId}` : 'fund:cash';
    await trx.raw('SELECT pg_advisory_xact_lock(hashtext(?))', [key]);
    const available = destination === 'bank' ? await bankBalance(destinationId, item.date, trx) : destination === 'wallet' ? await mobileWalletBalance(destinationId, item.date, trx) : await cashBalance(item.date, trx);
    if (Number(item.amount) > available) throw new Error('Destination account no longer has enough funds to cancel this transfer');
    const changed = await trx('treasury_transfers').where({ id, status: 'posted' }).update({
      status: 'cancelled',
      cancelled_at: trx.fn.now(),
      cancelled_by: data.cancelled_by,
      cancellation_reason: data.cancellation_reason,
    });
    if (item.transfer_request_id) await trx('treasury_transfer_requests').where({ id: item.transfer_request_id, status: 'approved' }).update({ status: 'cancelled' });
    return changed;
  });
}

async function reconcile(data) {
  const systemBalance = await bankBalance(data.bank_id, data.statement_date);
  const statementBalance = Number(data.statement_balance);
  const payload = { bank_id: data.bank_id, statement_date: data.statement_date, system_balance: systemBalance, statement_balance: statementBalance, difference: statementBalance - systemBalance, notes: data.notes || null, created_by: data.created_by };
  return (await db('bank_reconciliations').insert(payload).onConflict(['bank_id', 'statement_date']).merge(payload).returning('*'))[0];
}

async function reconciliations() { return db('bank_reconciliations as r').join('banks as b', 'r.bank_id', 'b.id').select('r.*', 'b.name as bank_name').orderBy('r.statement_date', 'desc'); }

async function cashbook({ from, to } = {}) {
  const collections = db('collections').where({ status: 'posted', payment_method: 'cash' }).select('id', 'date', 'purpose as description', 'amount').select(db.raw("'collection' as entry_type"));
  const expenses = db('expenses').where({ status: 'posted', payment_method: 'cash' }).select('id', 'date', 'purpose as description', 'amount').select(db.raw("'expense' as entry_type"));
  const transfersQ = db('treasury_transfers').where({ status: 'posted' }).whereIn('type', ['cash_to_bank', 'bank_to_cash', 'cash_to_wallet', 'wallet_to_cash']).select('id', 'date', 'remarks as description', 'amount', 'type as entry_type');
  const loanOut = db('mosque_loans').whereIn('status', ['active', 'overdue', 'paid']).where({ payment_method: 'cash' }).select('id', 'issue_date as date', 'purpose as description', 'principal_amount as amount').select(db.raw("'loan_issue' as entry_type"));
  const loanIn = db('loan_repayments as r').join('mosque_loans as l', 'r.loan_id', 'l.id').where({ 'r.payment_method': 'cash', 'r.status': 'posted' }).select('r.id', 'r.payment_date as date', db.raw("('Loan repayment ' || l.loan_no) as description"), 'r.amount').select(db.raw("'loan_repayment' as entry_type"));
  [collections, expenses, transfersQ, loanOut, loanIn].forEach((q) => { if (from) q.where(q === loanOut ? 'issue_date' : q === loanIn ? 'payment_date' : 'date', '>=', from); if (to) q.where(q === loanOut ? 'issue_date' : q === loanIn ? 'payment_date' : 'date', '<=', to); });
  const rows = [...await collections, ...await expenses, ...await transfersQ, ...await loanOut, ...await loanIn].sort((a, b) => new Date(a.date) - new Date(b.date));
  let running = from ? await cashBalance(new Date(new Date(from).getTime() - 86400000).toISOString().slice(0, 10)) : 0;
  return rows.map((row) => { const incoming = ['collection', 'bank_to_cash', 'wallet_to_cash', 'loan_repayment'].includes(row.entry_type); running += incoming ? Number(row.amount) : -Number(row.amount); return { ...row, incoming: incoming ? Number(row.amount) : 0, outgoing: incoming ? 0 : Number(row.amount), balance: running }; });
}

module.exports = { cashBalance, bankBalance, mobileWalletBalance, overview, transfers, createTransfer, transferRequests, requestTransfer, decideTransfer, cancelTransfer, reconcile, reconciliations, cashbook };
