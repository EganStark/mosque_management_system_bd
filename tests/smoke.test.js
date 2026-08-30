const request = require('supertest');
const { db, migrateAndSeed, teardown, extractCsrf } = require('./setup');
const app = require('../src/app');
const loans = require('../src/services/loans');
const pledges = require('../src/services/pledges');
const collections = require('../src/services/collections');
const treasury = require('../src/services/treasury');
const tasks = require('../src/services/tasks');
const taskTemplates = require('../src/services/task-templates');
const notifications = require('../src/services/notifications');
const dashboardPreferences = require('../src/services/dashboard-preferences');
const reports = require('../src/services/reports');
const unifiedCalendar = require('../src/services/calendar');
const landingPublishing = require('../src/services/landing-publishing');
const landingEvents = require('../src/services/events');
const landingGallery = require('../src/services/gallery');
const { uploadedFilePath } = require('../src/middleware/upload');
const uploadStorage = require('../src/services/upload-storage');
const procurement = require('../src/services/procurement');
const inventory = require('../src/services/inventory');
const maintenance = require('../src/services/maintenance');
const staffOperations = require('../src/services/staff-operations');
const welfare = require('../src/services/welfare');
const bookings = require('../src/services/bookings');
const publicInbox = require('../src/services/public-inbox');
const expenses = require('../src/services/expenses');
const dataQuality = require('../src/services/data-quality');
const mobileWallets = require('../src/services/mobile-wallets');
const users = require('../src/services/users');
const approvals = require('../src/services/approvals');
const { validateProductionEnvironment } = require('../src/config/environment');

beforeAll(async () => {
  await migrateAndSeed();
}, 30000);

afterAll(async () => {
  await teardown();
});

/** Log in with an agent and return it (cookies persisted). */
async function loginAs(username, password) {
  const agent = request.agent(app);
  const loginPage = await agent.get('/login');
  const token = extractCsrf(loginPage.text);
  await agent
    .post('/login')
    .type('form')
    .send({ _csrf: token, username, password })
    .expect(302);
  return agent;
}

describe('Procurement and inventory integrity', () => {
  test('partial deliveries remain open and cannot be posted into stock', async () => {
    const user = await db('users').where({ username: 'admin' }).first();
    let vendor; let purchaseRequest; let order; let item;
    try {
      [vendor] = await db('maintenance_vendors').insert({ name: `Test supplier ${Date.now()}` }).returning('*');
      purchaseRequest = await procurement.create({
        title: 'Stock integrity test',
        justification: 'Regression coverage',
        request_date: '2026-07-20',
        priority: 'normal',
        item_name: ['LED bulb'],
        specification: ['10 watt'],
        quantity: ['10'],
        unit: ['pcs'],
        estimated_unit_cost: ['50'],
      }, user.id);
      await procurement.submit(purchaseRequest.id);
      await procurement.decide(purchaseRequest.id, 'approved', null, user.id);
      const quote = await procurement.addQuotation(purchaseRequest.id, {
        vendor_id: vendor.id,
        quotation_date: '2026-07-20',
        quoted_amount: 500,
      }, user.id);
      order = await procurement.createOrder(purchaseRequest.id, {
        quotation_id: quote.id,
        order_date: '2026-07-20',
      }, user.id);
      const partial = await procurement.receive(order.id, {
        received_date: '2026-07-21',
        inspection_notes: 'Five of ten delivered',
        condition_status: 'partial',
      }, user.id);
      expect((await db('purchase_orders').where({ id: order.id }).first()).status).toBe('part_received');
      await expect(procurement.pay(order.id, {
        amount: 500,
        payment_date: '2026-07-21',
        payment_method: 'cash',
      }, user.id)).rejects.toThrow('Accept the goods before payment');
      item = await inventory.create({ name: `Test bulb ${Date.now()}`, unit: 'pcs' }, user.id);
      await expect(inventory.move(item.id, 'receipt', {
        quantity: 5,
        unit_cost: 50,
        movement_date: '2026-07-21',
        goods_receipt_id: partial.id,
      }, user.id)).rejects.toThrow('accepted goods receipt');
      expect(Number((await db('inventory_items').where({ id: item.id }).first()).stock_quantity)).toBe(0);
    } finally {
      if (item) {
        await db('inventory_movements').where({ item_id: item.id }).del();
        await db('inventory_items').where({ id: item.id }).del();
      }
      if (order) {
        await db('goods_receipts').where({ purchase_order_id: order.id }).del();
        await db('purchase_orders').where({ id: order.id }).del();
      }
      if (purchaseRequest) {
        await db('procurement_quotations').where({ request_id: purchaseRequest.id }).del();
        await db('purchase_request_items').where({ request_id: purchaseRequest.id }).del();
        await db('purchase_requests').where({ id: purchaseRequest.id }).del();
      }
      if (vendor) await db('maintenance_vendors').where({ id: vendor.id }).del();
    }
  });

  test('supplier payments require approval and can be reversed without losing history', async () => {
    const user = await db('users').where({ username: 'admin' }).first();
    let vendor; let purchaseRequest; let order; let paymentRequest; let payment; let funding; let budgetTarget; let budgetLine;
    try {
      [funding] = await db('collections').insert({ payer_name: 'Procurement test fund', purpose: 'Supplier authorization regression', amount: 1000, date: '2026-07-20', payment_method: 'cash', status: 'posted', created_by: user.id }).returning('*');
      [vendor] = await db('maintenance_vendors').insert({ name: `Authorization supplier ${Date.now()}` }).returning('*');
      purchaseRequest = await procurement.create({ title: 'Authorized purchase', justification: 'Regression coverage', request_date: '2026-07-20', priority: 'normal', item_name: ['Test item'], specification: [''], quantity: ['1'], unit: ['pcs'], estimated_unit_cost: ['100'] }, user.id);
      await procurement.submit(purchaseRequest.id);
      await procurement.decide(purchaseRequest.id, 'approved', null, user.id);
      const quote = await procurement.addQuotation(purchaseRequest.id, { vendor_id: vendor.id, quotation_date: '2026-07-20', quoted_amount: 100 }, user.id);
      order = await procurement.createOrder(purchaseRequest.id, { quotation_id: quote.id, order_date: '2026-07-20' }, user.id);
      await procurement.receive(order.id, { received_date: '2026-07-21', inspection_notes: 'Accepted', condition_status: 'accepted' }, user.id);

      paymentRequest = await procurement.requestPayment(order.id, { amount: 100, payment_date: '2097-09-21', payment_method: 'cash' }, user.id);
      expect(await db('purchase_payments').where({ purchase_order_id: order.id }).first()).toBeUndefined();
      await expect(procurement.requestPayment(order.id, { amount: 1, payment_date: '2097-09-21', payment_method: 'cash' }, user.id)).rejects.toThrow('unreserved outstanding');

      const procurementHead = await db('expense_heads').where({ name: 'ক্রয় ও সরবরাহ' }).first();
      [budgetTarget] = await db('management_targets').insert({ target_month: '2097-09-01', updated_by: user.id }).returning('*');
      [budgetLine] = await db('budget_lines').insert({ management_target_id: budgetTarget.id, line_type: 'expense', expense_head_id: procurementHead.id, budget_amount: 0, updated_by: user.id }).returning('*');
      await expect(procurement.decidePayment(paymentRequest.id, 'approved', 'Authorized', user.id)).rejects.toThrow('exceeds its budget line');
      payment = await procurement.decidePayment(paymentRequest.id, 'approved', 'Authorized', user.id, { budget_override_reason: 'Urgent approved procurement' });
      expect((await db('purchase_orders').where({ id: order.id }).first()).status).toBe('paid');
      expect(Number((await db('purchase_payment_requests').where({ id: paymentRequest.id }).first()).purchase_payment_id)).toBe(Number(payment.id));
      await expect(procurement.decidePayment(paymentRequest.id, 'approved', null, user.id)).rejects.toThrow('already been decided');

      await procurement.cancelPayment(order.id, payment.id, 'Duplicate supplier invoice', user.id);
      expect((await db('purchase_orders').where({ id: order.id }).first()).status).toBe('received');
      expect((await db('purchase_payments').where({ id: payment.id }).first()).status).toBe('cancelled');
      expect((await db('purchase_payment_requests').where({ id: paymentRequest.id }).first()).status).toBe('cancelled');
      expect((await db('expenses').where({ id: payment.expense_id }).first()).cancellation_reason).toBe('Duplicate supplier invoice');
      const approvalHistory = await approvals.history({ type: 'supplier-payments' });
      expect(approvalHistory.rows.some((row) => row.id === paymentRequest.id && row.decision === 'approved' && row.actorName === user.name)).toBe(true);
    } finally {
      if (order) {
        await db('purchase_payment_requests').where({ purchase_order_id: order.id }).del();
        const linkedExpenses = await db('purchase_payments').where({ purchase_order_id: order.id }).pluck('expense_id');
        await db('purchase_payments').where({ purchase_order_id: order.id }).del();
        if (linkedExpenses.length) await db('expenses').whereIn('id', linkedExpenses).del();
        await db('goods_receipts').where({ purchase_order_id: order.id }).del();
        await db('purchase_orders').where({ id: order.id }).del();
      }
      if (purchaseRequest) {
        await db('procurement_quotations').where({ request_id: purchaseRequest.id }).del();
        await db('purchase_request_items').where({ request_id: purchaseRequest.id }).del();
        await db('purchase_requests').where({ id: purchaseRequest.id }).del();
      }
      if (vendor) await db('maintenance_vendors').where({ id: vendor.id }).del();
      if (funding) await db('collections').where({ id: funding.id }).del();
      if (budgetLine) await db('budget_lines').where({ id: budgetLine.id }).del();
      if (budgetTarget) await db('management_targets').where({ id: budgetTarget.id }).del();
    }
  });
});

describe('Connected ledger safeguards', () => {
  test('maintenance completion does not post an expense before approval', async () => {
    const user = await db('users').where({ username: 'admin' }).first();
    const facility = await db('facilities').first();
    let workOrder; let completionRequest; let funding;
    try {
      [funding] = await db('collections').insert({ payer_name: 'Maintenance test fund', purpose: 'Completion approval regression', amount: 500, date: '2026-07-20', payment_method: 'cash', status: 'posted', created_by: user.id }).returning('*');
      workOrder = await maintenance.create({ facility_id: facility.id, title: 'Approval-gated repair', description: 'Regression coverage', maintenance_type: 'repair', priority: 'normal', reported_date: '2026-07-20', estimated_cost: 50 }, user.id);
      completionRequest = await maintenance.requestCompletion(workOrder.id, { completed_date: '2026-07-21', actual_cost: 50, payment_method: 'cash', completion_notes: 'Work inspected' }, user.id);
      expect((await maintenance.find(workOrder.id)).status).not.toBe('completed');
      expect(await db('expenses').where('purpose', 'like', `%${workOrder.work_order_no}%`).first()).toBeUndefined();
      await expect(maintenance.requestCompletion(workOrder.id, { completed_date: '2026-07-21', actual_cost: 1, payment_method: 'cash' }, user.id)).rejects.toThrow('already pending');
      await maintenance.decideCompletion(completionRequest.id, 'approved', 'Verified', user.id);
      const completed = await maintenance.find(workOrder.id);
      expect(completed.status).toBe('completed');
      expect(Number(completed.actual_cost)).toBe(50);
      expect(Number(completed.completion_request_id)).toBe(Number(completionRequest.id));
      expect(await db('expenses').where({ id: completed.expense_id, status: 'posted' }).first()).toBeTruthy();
      await expect(maintenance.decideCompletion(completionRequest.id, 'approved', 'Retry', user.id)).rejects.toThrow('already been decided');
      expect((await approvals.history({ type: 'maintenance-completions' })).rows.some((row) => row.id === completionRequest.id)).toBe(true);
    } finally {
      if (workOrder) {
        await db('maintenance_completion_requests').where({ work_order_id: workOrder.id }).del();
        const current = await db('maintenance_work_orders').where({ id: workOrder.id }).first();
        await db('maintenance_work_orders').where({ id: workOrder.id }).del();
        if (current?.expense_id) await db('expenses').where({ id: current.expense_id }).del();
      }
      if (funding) await db('collections').where({ id: funding.id }).del();
    }
  });

  test('payroll requests reserve the balance and post only after approval', async () => {
    const user = await db('users').where({ username: 'admin' }).first();
    const staff = await db('staff_members').first();
    let payroll; let paymentRequest; let payment; let funding; let budgetTarget; let budgetLine;
    try {
      [funding] = await db('collections').insert({ payer_name: 'Payroll test fund', purpose: 'Payroll approval regression', amount: 500, date: '2026-07-20', payment_method: 'cash', status: 'posted', created_by: user.id }).returning('*');
      [payroll] = await db('staff_payrolls').insert({ staff_id: staff.id, payroll_month: '2098-11-01', basic_salary: 100, allowances: 0, deductions: 0, net_payable: 100, amount_paid: 0, status: 'unpaid', generated_by: user.id }).returning('*');
      paymentRequest = await staffOperations.requestPayment(payroll.id, { amount: 100, payment_date: '2098-11-21', payment_method: 'cash' }, user.id);
      expect(Number((await db('staff_payrolls').where({ id: payroll.id }).first()).amount_paid)).toBe(0);
      await expect(staffOperations.requestPayment(payroll.id, { amount: 1, payment_date: '2098-11-21', payment_method: 'cash' }, user.id)).rejects.toThrow('unreserved payroll balance');
      const payrollHead = await db('expense_heads').where({ name: 'স্টাফ বেতন ও ভাতা' }).first();
      [budgetTarget] = await db('management_targets').insert({ target_month: '2098-11-01', updated_by: user.id }).returning('*');
      [budgetLine] = await db('budget_lines').insert({ management_target_id: budgetTarget.id, line_type: 'expense', expense_head_id: payrollHead.id, budget_amount: 50, updated_by: user.id }).returning('*');
      await expect(staffOperations.decidePayment(paymentRequest.id, 'approved', 'Checked', user.id)).rejects.toThrow('exceeds its budget line');
      payment = await staffOperations.decidePayment(paymentRequest.id, 'approved', 'Checked', user.id, { budget_override_reason: 'Approved salary obligation' });
      expect(Number((await db('staff_payrolls').where({ id: payroll.id }).first()).amount_paid)).toBe(100);
      expect(Number((await db('staff_payroll_payment_requests').where({ id: paymentRequest.id }).first()).payroll_payment_id)).toBe(Number(payment.id));
      await expect(staffOperations.decidePayment(paymentRequest.id, 'approved', 'Retry', user.id)).rejects.toThrow('already been decided');
      expect((await approvals.history({ type: 'payroll-payments' })).rows.some((row) => row.id === paymentRequest.id)).toBe(true);
      await expenses.cancel(payment.expense_id, { cancelled_by: user.id, cancellation_reason: 'Duplicate payroll run' });
      expect((await db('staff_payroll_payment_requests').where({ id: paymentRequest.id }).first()).status).toBe('cancelled');
    } finally {
      if (payroll) {
        await db('staff_payroll_payment_requests').where({ payroll_id: payroll.id }).del();
        const expenseIds = await db('staff_payroll_payments').where({ payroll_id: payroll.id }).pluck('expense_id');
        await db('staff_payroll_payments').where({ payroll_id: payroll.id }).del();
        await db('staff_payrolls').where({ id: payroll.id }).del();
        if (expenseIds.length) await db('expenses').whereIn('id', expenseIds).del();
      }
      if (funding) await db('collections').where({ id: funding.id }).del();
      if (budgetLine) await db('budget_lines').where({ id: budgetLine.id }).del();
      if (budgetTarget) await db('management_targets').where({ id: budgetTarget.id }).del();
    }
  });

  test('treasury transfer requests reserve funds without moving balances before approval', async () => {
    const user = await db('users').where({ username: 'admin' }).first();
    let bank; let funding; let transferRequest; let transfer; let secondAdmin;
    try {
      [bank] = await db('banks').insert({ name: `Transfer approval bank ${Date.now()}`, opening_balance: 0, is_active: true }).returning('*');
      [funding] = await db('collections').insert({ payer_name: 'Transfer request fund', purpose: 'Treasury approval regression', amount: 100, date: '2026-07-20', payment_method: 'cash', status: 'posted', created_by: user.id }).returning('*');
      const beforeCash = await treasury.cashBalance('2026-07-20'), beforeBank = await treasury.bankBalance(bank.id, '2026-07-20');
      transferRequest = await treasury.requestTransfer({ type: 'cash_to_bank', to_bank_id: bank.id, amount: beforeCash, date: '2026-07-20', reference: 'TR-APPROVAL' }, user.id);
      expect(await treasury.cashBalance('2026-07-20')).toBeCloseTo(beforeCash);
      expect(await treasury.bankBalance(bank.id, '2026-07-20')).toBeCloseTo(beforeBank);
      await expect(treasury.requestTransfer({ type: 'cash_to_bank', to_bank_id: bank.id, amount: 1, date: '2026-07-20' }, user.id)).rejects.toThrow('unreserved source balance');
      [secondAdmin] = await db('users').insert({ name: 'Treasury reviewer', username: `treasury_reviewer_${Date.now()}`, password_hash: user.password_hash, role: 'admin', is_active: true }).returning('*');
      await expect(treasury.decideTransfer(transferRequest.id, 'approved', 'Self approval', user.id)).rejects.toThrow('Another administrator');
      transfer = await treasury.decideTransfer(transferRequest.id, 'approved', 'Authorized', secondAdmin.id);
      expect(Number(transfer.transfer_request_id)).toBe(Number(transferRequest.id));
      await expect(treasury.decideTransfer(transferRequest.id, 'approved', 'Retry', secondAdmin.id)).rejects.toThrow('already been decided');
      expect(await treasury.cashBalance('2026-07-20')).toBeCloseTo(0);
      expect(await treasury.bankBalance(bank.id, '2026-07-20')).toBeCloseTo(beforeBank + beforeCash);
      expect((await approvals.history({ type: 'treasury-transfers' })).rows.some((row) => row.id === transferRequest.id)).toBe(true);
      await treasury.cancelTransfer(transfer.id, { cancelled_by: secondAdmin.id, cancellation_reason: 'Atomic reversal test' });
      expect((await db('treasury_transfer_requests').where({ id: transferRequest.id }).first()).status).toBe('cancelled');
      expect(await treasury.cashBalance('2026-07-20')).toBeCloseTo(beforeCash);
      expect(await treasury.bankBalance(bank.id, '2026-07-20')).toBeCloseTo(beforeBank);
    } finally {
      if (transferRequest) await db('treasury_transfer_requests').where({ id: transferRequest.id }).del();
      if (transfer) await db('treasury_transfers').where({ id: transfer.id }).del();
      if (funding) await db('collections').where({ id: funding.id }).del();
      if (bank) await db('banks').where({ id: bank.id }).del();
      if (secondAdmin) await db('users').where({ id: secondAdmin.id }).del();
    }
  });

  test('mobile wallet lifecycle preserves activity and protects opening balances', async () => {
    const user = await db('users').where({ username: 'admin' }).first();
    let wallet; let income; let expense;
    try {
      wallet = await mobileWallets.wallets.create({
        provider: 'other',
        name: `Lifecycle wallet ${Date.now()}`,
        account_number: `WL-${Date.now()}`,
      });
      income = await collections.create({
        payer_name: 'Wallet lifecycle fund',
        purpose: 'Wallet lifecycle regression',
        amount: 50,
        date: '2026-12-05',
        payment_method: 'mobile_banking',
        mobile_wallet_id: wallet.id,
        status: 'posted',
        created_by: user.id,
      });
      await expect(mobileWallets.wallets.setActive(wallet.id, false)).rejects.toThrow('balance');
      expense = await expenses.create({
        payee: 'Wallet lifecycle payee',
        purpose: 'Wallet lifecycle regression',
        amount: 50,
        date: '2026-12-05',
        payment_method: 'mobile_banking',
        mobile_wallet_id: wallet.id,
        status: 'posted',
        created_by: user.id,
      });
      await expect(mobileWallets.wallets.update(wallet.id, {
        provider: wallet.provider,
        name: wallet.name,
        account_number: wallet.account_number,
        opening_balance: 10,
        opening_balance_date: '2026-12-05',
      })).rejects.toThrow('financial activity');
      await mobileWallets.wallets.setActive(wallet.id, false);
      expect((await mobileWallets.wallets.find(wallet.id)).is_active).toBe(false);
      expect(Number((await db('collections').where({ mobile_wallet_id: wallet.id }).count('* as count').first()).count)).toBe(1);
      await mobileWallets.wallets.setActive(wallet.id, true);
      expect((await mobileWallets.wallets.find(wallet.id)).is_active).toBe(true);
    } finally {
      if (expense) await db('expenses').where({ id: expense.id }).del();
      if (income) await db('collections').where({ id: income.id }).del();
      if (wallet) await db('mobile_wallets').where({ id: wallet.id }).del();
    }
  });

  test('legacy bank entries enforce balances and preserve cancelled history', async () => {
    const user = await db('users').where({ username: 'admin' }).first();
    const date = '2026-12-04';
    let bank; let deposit; let withdrawal;
    try {
      [bank] = await db('banks').insert({
        name: `Controlled bank ledger ${Date.now()}`,
        account_number: 'CONTROL-TEST',
        is_active: true,
      }).returning('*');
      deposit = await require('../src/services/banks').transactions.create({
        bank_id: bank.id,
        type: 'deposit',
        amount: 100,
        date,
        created_by: user.id,
      });
      await expect(require('../src/services/banks').transactions.create({
        bank_id: bank.id,
        type: 'withdraw',
        amount: 101,
        date,
        created_by: user.id,
      })).rejects.toThrow('Insufficient bank balance');
      withdrawal = await require('../src/services/banks').transactions.create({
        bank_id: bank.id,
        type: 'withdraw',
        amount: 30,
        date,
        created_by: user.id,
      });
      expect(await treasury.bankBalance(bank.id, date)).toBe(70);
      await expect(require('../src/services/banks').banks.setActive(bank.id, false)).rejects.toThrow('balance');
      await require('../src/services/banks').transactions.cancel(withdrawal.id, {
        cancelled_by: user.id,
        cancellation_reason: 'Wrong withdrawal',
      });
      expect(await treasury.bankBalance(bank.id, date)).toBe(100);
      expect((await require('../src/services/banks').transactions.find(withdrawal.id)).status).toBe('cancelled');
      await require('../src/services/banks').transactions.cancel(deposit.id, {
        cancelled_by: user.id,
        cancellation_reason: 'Wrong deposit',
      });
      expect(await treasury.bankBalance(bank.id, date)).toBe(0);
      await expect(require('../src/services/banks').banks.update(bank.id, {
        name: bank.name,
        account_number: bank.account_number,
        opening_balance: 10,
        opening_balance_date: date,
      })).rejects.toThrow('financial activity');
      await require('../src/services/banks').banks.setActive(bank.id, false);
      expect((await require('../src/services/banks').banks.find(bank.id)).is_active).toBe(false);
      expect((await require('../src/services/banks').transactions.list({ bank_id: bank.id })).length).toBe(2);
      await require('../src/services/banks').banks.setActive(bank.id, true);
      expect((await require('../src/services/banks').banks.find(bank.id)).is_active).toBe(true);
    } finally {
      for (const transaction of [withdrawal, deposit]) {
        if (transaction) await db('bank_transactions').where({ id: transaction.id }).del();
      }
      if (bank) await db('banks').where({ id: bank.id }).del();
    }
  });

  test('data health detects missing wallet links and inconsistent loan totals', async () => {
    const user = await db('users').where({ username: 'admin' }).first();
    const wallet = await db('mobile_wallets').where({ provider: 'bkash', is_active: true }).first();
    let collection; let loan;
    try {
      [collection] = await db('collections').insert({
        payer_name: 'Broken wallet audit record',
        purpose: 'Data health regression',
        amount: 5,
        date: '2026-12-03',
        payment_method: 'mobile_banking',
        status: 'posted',
        created_by: user.id,
      }).returning('*');
      [loan] = await db('mosque_loans').insert({
        loan_no: `AUDIT-${Date.now()}`,
        borrower_name: 'Broken loan audit record',
        purpose: 'Data health regression',
        principal_amount: 100,
        repaid_amount: 25,
        issue_date: '2026-12-03',
        payment_method: 'cash',
        status: 'active',
        created_by: user.id,
      }).returning('*');
      const result = await dataQuality.audit();
      expect(result.issues.find((issue) => issue.key === 'collection-wallet').items.some((row) => row.id === collection.id)).toBe(true);
      expect(result.issues.find((issue) => issue.key === 'loan-ledger-mismatch').items.some((row) => row.id === loan.id)).toBe(true);
      await dataQuality.repairCollectionAccount(collection.id, { mobile_wallet_id: wallet.id });
      expect(Number((await db('collections').where({ id: collection.id }).first()).mobile_wallet_id)).toBe(wallet.id);
      const repaired = await dataQuality.audit();
      expect(repaired.issues.find((issue) => issue.key === 'collection-wallet')?.items.some((row) => row.id === collection.id) || false).toBe(false);
    } finally {
      if (loan) await db('mosque_loans').where({ id: loan.id }).del();
      if (collection) await db('collections').where({ id: collection.id }).del();
    }
  });

  test('treasury transfers move funds through mobile wallets and cancel safely', async () => {
    const user = await db('users').where({ username: 'admin' }).first();
    const wallet = await db('mobile_wallets').where({ provider: 'bkash', is_active: true }).first();
    let bank; let fund; let cashToWallet; let walletToBank;
    const date = '2026-12-02';
    try {
      [bank] = await db('banks').insert({
        name: `Wallet transfer bank ${Date.now()}`,
        account_number: 'TRANSFER-TEST',
        is_active: true,
      }).returning('*');
      [fund] = await db('collections').insert({
        payer_name: 'Transfer test fund',
        purpose: 'Wallet transfer regression',
        amount: 100,
        date,
        payment_method: 'cash',
        status: 'posted',
        created_by: user.id,
      }).returning('*');
      const cashBefore = await treasury.cashBalance(date);
      const walletBefore = await treasury.mobileWalletBalance(wallet.id, date);
      const bankBefore = await treasury.bankBalance(bank.id, date);
      cashToWallet = await treasury.createTransfer({
        type: 'cash_to_wallet',
        to_mobile_wallet_id: wallet.id,
        amount: 50,
        date,
        created_by: user.id,
      });
      expect(await treasury.cashBalance(date)).toBe(cashBefore - 50);
      expect(await treasury.mobileWalletBalance(wallet.id, date)).toBe(walletBefore + 50);
      walletToBank = await treasury.createTransfer({
        type: 'wallet_to_bank',
        from_mobile_wallet_id: wallet.id,
        to_bank_id: bank.id,
        amount: 20,
        date,
        created_by: user.id,
      });
      expect(await treasury.mobileWalletBalance(wallet.id, date)).toBe(walletBefore + 30);
      expect(await treasury.bankBalance(bank.id, date)).toBe(bankBefore + 20);
      await treasury.cancelTransfer(walletToBank.id, {
        cancelled_by: user.id,
        cancellation_reason: 'Regression reversal',
      });
      expect(await treasury.mobileWalletBalance(wallet.id, date)).toBe(walletBefore + 50);
      expect(await treasury.bankBalance(bank.id, date)).toBe(bankBefore);
      await treasury.cancelTransfer(cashToWallet.id, {
        cancelled_by: user.id,
        cancellation_reason: 'Regression reversal',
      });
      expect(await treasury.cashBalance(date)).toBe(cashBefore);
      expect(await treasury.mobileWalletBalance(wallet.id, date)).toBe(walletBefore);
    } finally {
      for (const transfer of [walletToBank, cashToWallet]) {
        if (transfer) await db('treasury_transfers').where({ id: transfer.id }).del();
      }
      if (fund) await db('collections').where({ id: fund.id }).del();
      if (bank) await db('banks').where({ id: bank.id }).del();
    }
  });

  test('mobile wallet income is traceable and wallet outflows cannot overdraw', async () => {
    const user = await db('users').where({ username: 'admin' }).first();
    const wallet = await db('mobile_wallets').where({ provider: 'bkash', is_active: true }).first();
    let income; let expense;
    try {
      await expect(collections.create({
        purpose: 'Missing wallet test',
        amount: 20,
        date: '2026-12-01',
        payment_method: 'mobile_banking',
        status: 'posted',
        created_by: user.id,
      })).rejects.toThrow('active mobile wallet');
      income = await collections.create({
        purpose: 'Wallet funding test',
        amount: 20,
        date: '2026-12-01',
        payment_method: 'mobile_banking',
        mobile_wallet_id: wallet.id,
        status: 'posted',
        created_by: user.id,
      });
      await expect(expenses.create({
        purpose: 'Wallet overdraft test',
        amount: 21,
        date: '2026-12-01',
        payment_method: 'mobile_banking',
        mobile_wallet_id: wallet.id,
        status: 'posted',
        created_by: user.id,
      })).rejects.toThrow('Insufficient mobile wallet balance');
      expense = await expenses.create({
        purpose: 'Funded wallet expense',
        amount: 6,
        date: '2026-12-01',
        payment_method: 'mobile_banking',
        mobile_wallet_id: wallet.id,
        status: 'posted',
        created_by: user.id,
      });
      expect(await treasury.mobileWalletBalance(wallet.id, '2026-12-01')).toBe(14);
    } finally {
      if (expense) await db('expenses').where({ id: expense.id }).del();
      if (income) await db('collections').where({ id: income.id }).del();
    }
  });

  test('core ledger services accept only valid methods and active banks', async () => {
    const user = await db('users').where({ username: 'admin' }).first();
    let inactiveBank; let activeBank; let collection; let expense;
    try {
      [inactiveBank] = await db('banks').insert({ name: `Inactive test bank ${Date.now()}`, is_active: false }).returning('*');
      [activeBank] = await db('banks').insert({ name: `Active test bank ${Date.now()}`, is_active: true }).returning('*');
      await expect(collections.create({
        purpose: 'Inactive bank test',
        amount: 10,
        date: '2026-11-01',
        payment_method: 'bank',
        bank_id: inactiveBank.id,
        status: 'posted',
        created_by: user.id,
      })).rejects.toThrow('active bank');
      await expect(expenses.create({
        purpose: 'Invalid method test',
        amount: 10,
        date: '2026-11-01',
        payment_method: 'cheque',
        status: 'posted',
        created_by: user.id,
      })).rejects.toThrow('valid payment method');
      await expect(loans.create({
        borrower_name: 'Inactive bank borrower',
        purpose: 'Validation test',
        principal_amount: 10,
        issue_date: '2026-11-01',
        payment_method: 'bank',
        bank_id: inactiveBank.id,
      }, user.id)).rejects.toThrow('active bank');
      collection = await collections.create({
        purpose: 'Active bank test',
        amount: 10,
        date: '2026-11-01',
        payment_method: 'bank',
        bank_id: activeBank.id,
        status: 'posted',
        created_by: user.id,
      });
      expect(Number(collection.bank_id)).toBe(activeBank.id);
      await expect(expenses.create({
        purpose: 'Bank overdraft test',
        amount: 11,
        date: '2026-11-01',
        payment_method: 'bank',
        bank_id: activeBank.id,
        status: 'posted',
        created_by: user.id,
      })).rejects.toThrow('Insufficient bank balance');
      expense = await expenses.create({
        purpose: 'Funded bank expense',
        amount: 6,
        date: '2026-11-01',
        payment_method: 'bank',
        bank_id: activeBank.id,
        status: 'posted',
        created_by: user.id,
      });
      expect(await treasury.bankBalance(activeBank.id, '2026-11-01')).toBe(4);
    } finally {
      if (expense) await db('expenses').where({ id: expense.id }).del();
      if (collection) await db('collections').where({ id: collection.id }).del();
      if (activeBank) await db('banks').where({ id: activeBank.id }).del();
      if (inactiveBank) await db('banks').where({ id: inactiveBank.id }).del();
    }
  });

  test('automatic financial workflows cannot change a closed accounting month', async () => {
    const user = await db('users').where({ username: 'admin' }).first();
    const periodMonth = '2099-01-01';
    await db('accounting_periods').insert({ period_month: periodMonth, status: 'closed' });
    try {
      const closed = '2099-01-15';
      await expect(maintenance.complete(0, { completed_date: closed }, user.id)).rejects.toThrow('2099-01');
      await expect(staffOperations.pay(0, { payment_date: closed }, user.id)).rejects.toThrow('2099-01');
      await expect(welfare.disburse(0, { disbursement_date: closed }, user.id)).rejects.toThrow('2099-01');
      await expect(bookings.addPayment(0, { payment_date: closed }, user.id)).rejects.toThrow('2099-01');
      await expect(pledges.pay(0, { payment_date: closed }, user.id)).rejects.toThrow('2099-01');
    } finally {
      await db('accounting_periods').where({ period_month: periodMonth }).del();
    }
  });

  test('online donation verification also respects the current closed month', async () => {
    const user = await db('users').where({ username: 'admin' }).first();
    const today = new Date().toISOString().slice(0, 10);
    const periodMonth = `${today.slice(0, 7)}-01`;
    let donation;
    try {
      donation = await publicInbox.createDonation({
        amount: 100,
        transactionId: `closed-period-${Date.now()}`,
        donationType: 'general',
        paymentMethod: 'bkash',
        donorName: 'Period test',
        phone: '01000000000',
      }, '127.0.0.1');
      await db('accounting_periods').insert({ period_month: periodMonth, status: 'closed' }).onConflict('period_month').merge({ status: 'closed' });
      await expect(publicInbox.reviewDonation(donation.id, 'verify', null, user.id)).rejects.toThrow(today.slice(0, 7));
      expect((await db('online_donation_submissions').where({ id: donation.id }).first()).status).toBe('pending');
    } finally {
      if (donation) await db('online_donation_submissions').where({ id: donation.id }).del();
      await db('accounting_periods').where({ period_month: periodMonth }).del();
    }
  });

  test('bank donation verification requires and records the receiving account', async () => {
    const user = await db('users').where({ username: 'admin' }).first();
    let bank; let donation; let collection;
    try {
      [bank] = await db('banks').insert({
        name: `Online donation bank ${Date.now()}`,
        account_number: 'TEST-ONLINE-001',
        is_active: true,
      }).returning('*');
      donation = await publicInbox.createDonation({
        amount: 125,
        transactionId: `bank-donation-${Date.now()}`,
        donationType: 'general',
        paymentMethod: 'bank',
        donorName: 'Bank donor',
        phone: '01000000000',
      }, '127.0.0.1');
      await expect(
        publicInbox.reviewDonation(donation.id, 'verify', null, user.id),
      ).rejects.toThrow('bank account');
      expect(
        (await db('online_donation_submissions').where({ id: donation.id }).first()).status,
      ).toBe('pending');
      collection = await publicInbox.reviewDonation(
        donation.id,
        'verify',
        { bank_id: bank.id, review_notes: 'Statement matched' },
        user.id,
      );
      expect(Number(collection.bank_id)).toBe(bank.id);
      const reviewed = (await publicInbox.donations()).find((row) => row.id === donation.id);
      expect(reviewed.bank_name).toBe(bank.name);
      expect(reviewed.account_number).toBe(bank.account_number);
    } finally {
      if (donation) await db('online_donation_submissions').where({ id: donation.id }).del();
      if (collection) await db('collections').where({ id: collection.id }).del();
      if (bank) await db('banks').where({ id: bank.id }).del();
    }
  });
});

describe('Linked payment reversals', () => {
  test('cancelling a booking receipt restores its outstanding balance', async () => {
    const user = await db('users').where({ username: 'admin' }).first();
    const facility = await db('facilities').where({ is_active: true }).first();
    let booking; let receipt;
    try {
      booking = await bookings.create({
        facility_id: facility.id,
        requester_name: 'Cancellation test',
        requester_phone: '01000000000',
        booking_type: 'meeting',
        event_title: `Cancellation test ${Date.now()}`,
        booking_date: '2026-10-10',
        start_time: '09:00',
        end_time: '10:00',
        fee_amount: 100,
      }, user.id);
      await bookings.addPayment(booking.id, { amount: 100, payment_date: '2026-10-01', payment_method: 'cash' }, user.id);
      receipt = await db('collections').where({ purpose: `Facility booking ${booking.booking_no}` }).first();
      expect((await bookings.find(booking.id)).payment_status).toBe('paid');
      await collections.cancel(receipt.id, { cancelled_by: user.id, cancellation_reason: 'Regression reversal' });
      const restored = await bookings.find(booking.id);
      expect(Number(restored.amount_paid)).toBe(0);
      expect(restored.payment_status).toBe('unpaid');
      expect(restored.payments[0].status).toBe('cancelled');
    } finally {
      if (booking) await db('facility_booking_payments').where({ booking_id: booking.id }).del();
      if (receipt) await db('collections').where({ id: receipt.id }).del();
      if (booking) await db('facility_bookings').where({ id: booking.id }).del();
    }
  });

  test('cancelling a payroll voucher restores payroll due without deleting history', async () => {
    const user = await db('users').where({ username: 'admin' }).first();
    let staff; let payroll; let expense; let funding;
    try {
      [funding] = await db('collections').insert({
        payer_name: 'Payroll reversal test fund',
        purpose: 'Payroll reversal regression funding',
        amount: 100,
        date: '2026-10-01',
        payment_method: 'cash',
        status: 'posted',
        created_by: user.id,
      }).returning('*');
      [staff] = await db('staff_members').insert({
        name_bn: `Test staff ${Date.now()}`,
        name_en: 'Test staff',
        position_bn: 'Test',
        position_en: 'Test',
      }).returning('*');
      [payroll] = await db('staff_payrolls').insert({
        staff_id: staff.id,
        payroll_month: '2026-10-01',
        basic_salary: 100,
        net_payable: 100,
        amount_paid: 100,
        status: 'paid',
        generated_by: user.id,
      }).returning('*');
      expense = await expenses.create({
        purpose: 'Payroll reversal test',
        amount: 100,
        date: '2026-10-01',
        payment_method: 'cash',
        status: 'posted',
        created_by: user.id,
      });
      await db('staff_payroll_payments').insert({
        payroll_id: payroll.id,
        expense_id: expense.id,
        amount: 100,
        payment_date: '2026-10-01',
        payment_method: 'cash',
        paid_by: user.id,
      });
      await expenses.cancel(expense.id, { cancelled_by: user.id, cancellation_reason: 'Regression reversal' });
      const restored = await db('staff_payrolls').where({ id: payroll.id }).first();
      expect(Number(restored.amount_paid)).toBe(0);
      expect(restored.status).toBe('unpaid');
      expect((await db('staff_payroll_payments').where({ payroll_id: payroll.id }).first()).status).toBe('cancelled');
    } finally {
      if (payroll) await db('staff_payroll_payments').where({ payroll_id: payroll.id }).del();
      if (expense) await db('expenses').where({ id: expense.id }).del();
      if (payroll) await db('staff_payrolls').where({ id: payroll.id }).del();
      if (staff) await db('staff_members').where({ id: staff.id }).del();
      if (funding) await db('collections').where({ id: funding.id }).del();
    }
  });
});

describe('Authentication & RBAC', () => {
  test('unauthenticated dashboard redirects to /login', async () => {
    const res = await request(app).get('/dashboard');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/login');
  });

  test('wrong password does not authenticate', async () => {
    const agent = request.agent(app);
    const page = await agent.get('/login');
    const token = extractCsrf(page.text);
    const res = await agent.post('/login').type('form').send({ _csrf: token, username: 'admin', password: 'wrong' });
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/login');
  });

  test('admin can log in and reach the dashboard', async () => {
    const agent = await loginAs('admin', 'Admin@2026');
    const res = await agent.get('/dashboard');
    expect(res.status).toBe(200);
    expect(res.text).toContain('space_dashboard');
  });

  test('viewer cannot access user management', async () => {
    const viewerUsername = `viewer_${Date.now()}`;
    await db('users').insert({
      name: 'Viewer', username: viewerUsername, role: 'viewer', is_active: true,
      password_hash: require('bcryptjs').hashSync('Viewer@123', 10),
    });
    const agent = await loginAs(viewerUsername, 'Viewer@123');
    const res = await agent.get('/users');
    expect(res.status).toBe(403);
  });

  test('viewer can read reports but cannot read member or finance modules', async () => {
    const username = `report_viewer_${Date.now()}`;
    await db('users').insert({ name: 'Report Viewer', username, role: 'viewer', is_active: true, password_hash: require('bcryptjs').hashSync('Viewer@123', 10) });
    const agent = await loginAs(username, 'Viewer@123');
    expect((await agent.get('/reports')).status).toBe(200);
    expect((await agent.get('/members')).status).toBe(403);
    expect((await agent.get('/collections')).status).toBe(403);
    expect((await agent.get('/welfare')).status).toBe(403);
    const dashboard = await agent.get('/dashboard');
    expect(dashboard.text).toContain('href="/reports"');
    expect(dashboard.text).toContain('দর্শক');
    expect(dashboard.text).not.toContain('href="/members"');
    expect(dashboard.text).not.toContain('href="/collections"');
    expect(dashboard.text).not.toContain('href="/landing"');
    expect(dashboard.text).not.toContain('href="/users"');
  });

  test('collector access follows the permission matrix for reads', async () => {
    const username = `collector_${Date.now()}`;
    await db('users').insert({ name: 'Collector', username, role: 'collector', is_active: true, password_hash: require('bcryptjs').hashSync('Collector@123', 10) });
    const agent = await loginAs(username, 'Collector@123');
    expect((await agent.get('/members')).status).toBe(200);
    expect((await agent.get('/collections')).status).toBe(200);
    expect((await agent.get('/programs')).status).toBe(403);
    expect((await agent.get('/landing')).status).toBe(403);
    const dashboard = await agent.get('/dashboard');
    expect(dashboard.text).toContain('href="/members"');
    expect(dashboard.text).toContain('href="/collections"');
    expect(dashboard.text).toContain('কালেক্টর');
    expect(dashboard.text).not.toContain('href="/programs"');
    expect(dashboard.text).not.toContain('href="/landing"');
    const csrf = extractCsrf(dashboard.text);
    const protectedActions = [
      ['/collections/999999/cancel', { cancellation_reason: 'Unauthorized reversal' }],
      ['/expenses/999999/cancel', { cancellation_reason: 'Unauthorized reversal' }],
      ['/banks/999999/cancel', { cancellation_reason: 'Unauthorized reversal' }],
      ['/loans/999999/cancel', { cancellation_reason: 'Unauthorized reversal' }],
      ['/monthly-payments/generate', { month: '2026-07' }],
      ['/treasury/transfer', { type: 'cash_to_bank', amount: 1, date: '2026-07-01' }],
      ['/treasury/reconcile', { bank_id: 1, statement_date: '2026-07-01', statement_balance: 1 }],
    ];
    for (const [path, payload] of protectedActions) {
      const response = await agent.post(path).type('form').send({ _csrf: csrf, ...payload });
      expect(response.status).toBe(403);
    }
  });

  test('a collector with website permission can manage CMS without system access', async () => {
    const username = `content_editor_${Date.now()}`; let event;
    await db('users').insert({ name: 'Content Editor', username, role: 'collector', is_active: true, password_hash: require('bcryptjs').hashSync('Editor@123', 10) });
    await db('role_permissions').where({ role: 'collector', permission: 'website.manage' }).update({ allowed: true });
    try {
      event = await landingEvents.create({ title_bn: `অনুমোদন ${Date.now()}`, title_en: `Approval ${Date.now()}`, description_bn: 'সম্পূর্ণ বিবরণ', description_en: 'Complete description', category: 'general', event_date: '2026-08-01', event_time: '10:00', location: 'Test', is_active: 'on' });
      const agent = await loginAs(username, 'Editor@123');
      const cms = await agent.get('/landing');
      expect(cms.status).toBe(200);
      expect(cms.text).toContain('ওয়েবসাইট কনটেন্ট');
      expect(cms.text).toContain('href="/landing"');
      expect(cms.text).not.toContain('href="/users"');
      expect((await agent.get('/landing/events/new')).status).toBe(200);
      const queue = await agent.get('/landing/publishing');
      expect(queue.text).toContain('Editor mode');
      expect(queue.text).not.toContain('action="/landing/publishing/bulk"');
      expect(queue.text).toContain('value="review"');
      const publishToken = extractCsrf(queue.text);
      expect((await agent.post(`/landing/publishing/events/${event.id}`).type('form').send({ _csrf: publishToken, status: 'published' })).status).toBe(403);
      await db('role_permissions').where({ role: 'collector', permission: 'website.publish' }).update({ allowed: true });
      expect((await agent.post(`/landing/publishing/events/${event.id}`).type('form').send({ _csrf: publishToken, status: 'published' })).status).toBe(302);
      expect((await landingEvents.find(event.id)).publication_status).toBe('published');
      const exportResponse = await agent.get('/landing/publishing/export.csv');
      expect(exportResponse.status).toBe(200);
      expect(exportResponse.headers['content-type']).toMatch(/text\/csv/);
      expect((await agent.get('/users')).status).toBe(403);
      expect((await agent.get('/security')).status).toBe(403);
    } finally {
      await db('role_permissions').where({ role: 'collector', permission: 'website.manage' }).update({ allowed: false });
      await db('role_permissions').where({ role: 'collector', permission: 'website.publish' }).update({ allowed: false });
      if (event) { await db('landing_publication_events').where({ content_type: 'events', content_id: event.id }).del(); await db('events').where({ id: event.id }).del(); }
    }
  });

  test('login rotates the anonymous session identifier', async () => {
    const agent = request.agent(app);
    const page = await agent.get('/login');
    const before = (page.headers['set-cookie'] || []).find((x) => x.startsWith('brjm.sid='));
    const token = extractCsrf(page.text);
    const login = await agent.post('/login').type('form').send({ _csrf: token, username: 'admin', password: 'Admin@2026' });
    const after = (login.headers['set-cookie'] || []).find((x) => x.startsWith('brjm.sid='));
    expect(before).toBeTruthy(); expect(after).toBeTruthy(); expect(after.split(';')[0]).not.toBe(before.split(';')[0]);
  });
});

describe('Admin management page rendering', () => {
  test('all primary management pages render after login', async () => {
    const agent = await loginAs('admin', 'Admin@2026');
    const pages = [
      '/dashboard',
      '/approvals',
      '/approvals/history',
      '/calendar',
      '/members',
      '/monthly-payments',
      '/collections',
      '/expenses',
      '/treasury',
      '/treasury/transfer',
      '/loans',
      '/pledges',
      '/staff-operations',
      '/welfare',
      '/programs',
      '/bookings',
      '/maintenance',
      '/procurement',
      '/inventory',
      '/assets',
      '/governance-meetings',
      '/documents',
      '/tasks',
      '/communications',
      '/public-inbox',
      '/public-inbox?tab=donations',
      '/data-quality',
      '/reports',
      '/landing',
    ];
    const failures = [];
    for (const page of pages) {
      const response = await agent.get(page);
      if (response.status !== 200) failures.push(`${page}: HTTP ${response.status}`);
      if (/column .* does not exist|relation .* does not exist|ReferenceError|TypeError:/i.test(response.text)) {
        failures.push(`${page}: runtime error rendered`);
      }
    }
    expect(failures).toEqual([]);
  });
});

describe('Request security', () => {
  test('health endpoint reports database readiness without authentication', async () => {
    const response = await request(app).get('/healthz');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok', database: 'ready' });
  });

  test('automated backup trigger is unavailable without a configured machine secret', async () => {
    const previous = process.env.BACKUP_TRIGGER_SECRET;
    delete process.env.BACKUP_TRIGGER_SECRET;
    try {
      const response = await request(app).post('/internal/backups/run');
      expect(response.status).toBe(503);
      expect(response.body.error).toBe('Automated backup trigger is not configured');
    } finally {
      if (previous === undefined) delete process.env.BACKUP_TRIGGER_SECRET;
      else process.env.BACKUP_TRIGGER_SECRET = previous;
    }
  });

  test('automated backup trigger rejects an invalid bearer secret', async () => {
    const previous = process.env.BACKUP_TRIGGER_SECRET;
    process.env.BACKUP_TRIGGER_SECRET = 'server-backup-secret-0123456789abcdef';
    try {
      const response = await request(app)
        .post('/internal/backups/run')
        .set('Authorization', 'Bearer incorrect-backup-secret');
      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Unauthorized');
    } finally {
      if (previous === undefined) delete process.env.BACKUP_TRIGGER_SECRET;
      else process.env.BACKUP_TRIGGER_SECRET = previous;
    }
  });

  test('production environment validation rejects placeholders and accepts secure configuration', () => {
    expect(() => validateProductionEnvironment({
      SESSION_SECRET: 'change-this-to-a-long-random-string',
      CSRF_SECRET: 'change-this-to-another-long-random-string',
      SUBMISSION_HASH_SECRET: 'change-this-to-a-separate-random-string',
      DATABASE_URL: 'postgres://postgres:postgres@localhost/database',
      LANDING_PAGE_ORIGIN: 'http://localhost:8080',
      LANDING_PAGE_URL: 'http://localhost:8080',
      TRUST_PROXY: 'false',
    })).toThrow('Invalid production environment');

    expect(validateProductionEnvironment({
      SESSION_SECRET: 'session_0123456789abcdefghijklmnopqrstuvwxyz',
      CSRF_SECRET: 'csrf_0123456789abcdefghijklmnopqrstuvwxyz',
      SUBMISSION_HASH_SECRET: 'submission_0123456789abcdefghijklmnopqrstuvwxyz',
      DATABASE_URL: 'postgresql://app:secret@database.internal:5432/mosque',
      LANDING_PAGE_ORIGIN: 'https://mosque.example.org',
      LANDING_PAGE_URL: 'https://mosque.example.org',
      TRUST_PROXY: 'true',
      STORAGE_PROVIDER: 'local',
      IMAGE_UPLOAD_DIR: 'C:\\brjm-data\\uploads',
      DOCUMENT_STORAGE_DIR: 'C:\\brjm-data\\documents',
      BACKUP_STORAGE_DIR: 'C:\\brjm-data\\backups',
      SMS_GATEWAY_ENABLED: 'false',
    })).toBe(true);

    expect(validateProductionEnvironment({
      SESSION_SECRET: 'session_0123456789abcdefghijklmnopqrstuvwxyz',
      CSRF_SECRET: 'csrf_0123456789abcdefghijklmnopqrstuvwxyz',
      SUBMISSION_HASH_SECRET: 'submission_0123456789abcdefghijklmnopqrstuvwxyz',
      DATABASE_URL: 'postgresql://app:secret@database.internal:5432/mosque',
      LANDING_PAGE_ORIGIN: 'https://mosque.example.org',
      LANDING_PAGE_URL: 'https://mosque.example.org',
      TRUST_PROXY: 'true',
      STORAGE_PROVIDER: 'supabase',
      SUPABASE_URL: 'https://mosque-project.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service_role_0123456789abcdefghijklmnopqrstuvwxyz',
      SUPABASE_PUBLIC_BUCKET: 'public-media',
      SUPABASE_PRIVATE_BUCKET: 'private-documents',
      SUPABASE_BACKUP_BUCKET: 'database-backups',
      ADMIN_USERNAME: 'private-owner',
      DEMO_MODE: 'true',
      DEMO_USERNAME: 'portfolio-demo',
      DEMO_PASSWORD: 'PublicDemoPassword@2026',
      DEMO_DATA_ENABLED: 'true',
      SMS_GATEWAY_ENABLED: 'false',
    })).toBe(true);
  });
  test('state-changing requests without CSRF are rejected', async () => {
    const agent = await loginAs('admin', 'Admin@2026');
    const res = await agent.post('/collections').type('form').send({ amount: 10, date: '2026-07-21', payment_method: 'cash' });
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/dashboard');
  });

  test('public demo account can browse admin modules but cannot change data', async () => {
    const username = `demo_${Date.now()}`;
    const password = 'SafeDemoPassword@2026';
    const previous = {
      mode: process.env.DEMO_MODE,
      username: process.env.DEMO_USERNAME,
    };
    try {
      await users.create({
        name: 'Read-only Demo',
        username,
        email: `${username}@example.invalid`,
        password,
        role: 'demo',
      });
      process.env.DEMO_MODE = 'true';
      process.env.DEMO_USERNAME = username;

      const agent = await loginAs(username, password);
      const membersPage = await agent.get('/members');
      expect(membersPage.status).toBe(200);
      expect(membersPage.text).toContain('Demo mode:');

      const blocked = await agent
        .post('/settings')
        .type('form')
        .send({ _csrf: extractCsrf(membersPage.text), company_name: 'Must not be saved' });
      expect(blocked.status).toBe(403);
      expect(blocked.text).toContain('read-only');

      const logout = await agent
        .post('/logout')
        .type('form')
        .send({ _csrf: extractCsrf(blocked.text) });
      expect(logout.status).toBe(302);
      expect(logout.headers.location).toBe('/login');
    } finally {
      if (previous.mode === undefined) delete process.env.DEMO_MODE;
      else process.env.DEMO_MODE = previous.mode;
      if (previous.username === undefined) delete process.env.DEMO_USERNAME;
      else process.env.DEMO_USERNAME = previous.username;
      await db('audit_logs').where({ username }).del();
      await db('users').where({ username }).del();
    }
  });

  test('public API does not grant CORS to an untrusted origin', async () => {
    const res = await request(app).get('/api/prayer-times').set('Origin', 'https://evil.example');
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  test('session cookie is HttpOnly and SameSite=Lax', async () => {
    const res = await request(app).get('/login');
    const cookie = (res.headers['set-cookie'] || []).find((x) => x.startsWith('brjm.sid='));
    expect(cookie).toMatch(/HttpOnly/i); expect(cookie).toMatch(/SameSite=Lax/i);
  });
});

describe('Member creation', () => {
  test('member archive preserves financial history and requires a dedicated restore', async () => {
    const user = await db('users').where({ username: 'admin' }).first();
    let member; let receipt;
    try {
      member = await require('../src/services/members').create({
        id_no: `ARCH-${Date.now()}`,
        name: 'Archive Member Test',
        phone: '01000000001',
        gender: 'male',
        status: 'deactive',
      });
      expect(member.status).toBe('active');
      receipt = await collections.create({
        member_id: member.id,
        payer_name: member.name,
        purpose: 'Archive history regression',
        amount: 10,
        date: '2026-12-06',
        payment_method: 'cash',
        status: 'posted',
        created_by: user.id,
      });
      await expect(require('../src/services/members').setStatus(member.id, 'deactive', '')).rejects.toThrow('reason');
      await require('../src/services/members').setStatus(member.id, 'deactive', 'Moved away');
      expect((await require('../src/services/members').find(member.id)).status).toBe('deactive');
      expect((await db('collections').where({ id: receipt.id }).first()).member_id).toBe(member.id);
      expect((await require('../src/services/members').options()).some((row) => row.id === member.id)).toBe(false);
      await require('../src/services/members').update(member.id, { ...member, name: 'Archived Member Updated', status: 'active' });
      expect((await require('../src/services/members').find(member.id)).status).toBe('deactive');
      await require('../src/services/members').setStatus(member.id, 'active');
      expect((await require('../src/services/members').find(member.id)).status).toBe('active');
    } finally {
      if (receipt) await db('collections').where({ id: receipt.id }).del();
      if (member) await db('members').where({ id: member.id }).del();
    }
  });

  test('admin can create a member and see it listed', async () => {
    const agent = await loginAs('admin', 'Admin@2026');
    const form = await agent.get('/members/new');
    const token = extractCsrf(form.text);
    const uniqueName = `Regression Member ${Date.now()}`;
    const create = await agent
      .post('/members')
      .type('form')
      .send({ _csrf: token, name: uniqueName, phone: '01799999999', gender: 'male', status: 'active', monthly_payment: 'false' });
    expect(create.status).toBe(302);

    const list = await agent.get('/members');
    expect(list.text).toContain(uniqueName);

    const row = await db('members').where({ name: uniqueName }).first();
    expect(row).toBeTruthy();
    expect(row.id_no).toMatch(/^\d{4,}$/);
  });
});

describe('Collection creation updates totals', () => {
  test('a collection increases the collection total', async () => {
    const agent = await loginAs('admin', 'Admin@2026');
    const member = await db('members').first();
    const form = await agent.get('/collections/new');
    const token = extractCsrf(form.text);
    const before = Number((await db('collections').sum('amount as s'))[0].s || 0);
    const res = await agent
      .post('/collections')
      .type('form')
      .send({ _csrf: token, member_id: member.id, amount: '1234.50', date: '2026-05-10', payment_method: 'cash', purpose: 'Regression collection' });
    expect(res.status).toBe(302);
    const after = Number((await db('collections').sum('amount as s'))[0].s || 0);
    expect(after - before).toBeCloseTo(1234.5, 2);
  });
});

describe('Connected financial workflows', () => {
  test('loan issue and full repayment preserve treasury accounting', async () => {
    const user = await db('users').where({ username: 'admin' }).first();
    const today = '2026-07-21';
    const [fund] = await db('collections').insert({ payer_name: 'Test fund', purpose: 'Loan test funding', amount: 500, date: today, payment_method: 'cash', status: 'posted', created_by: user.id }).returning('*');
    let loan;
    try {
      const before = await treasury.cashBalance();
      loan = await loans.create({ borrower_name: `Loan Test ${Date.now()}`, purpose: 'Regression', principal_amount: 100, issue_date: today, payment_method: 'cash' }, user.id);
      expect(await treasury.cashBalance()).toBe(before - 100);
      await loans.repay(loan.id, { amount: 100, payment_date: today, payment_method: 'cash' }, user.id);
      const completed = await loans.find(loan.id);
      expect(completed.status).toBe('paid');
      expect(Number(completed.repaid_amount)).toBe(100);
      expect(await treasury.cashBalance()).toBe(before);
    } finally {
      if (loan) { await db('loan_repayments').where({ loan_id: loan.id }).del(); await db('mosque_loans').where({ id: loan.id }).del(); }
      await db('collections').where({ id: fund.id }).del();
    }
  });

  test('mobile wallet loan disbursement and repayment update the wallet ledger', async () => {
    const user = await db('users').where({ username: 'admin' }).first();
    const wallet = await db('mobile_wallets').where({ provider: 'bkash', is_active: true }).first();
    const today = '2026-07-22';
    let fund; let loan;
    try {
      [fund] = await db('collections').insert({
        payer_name: 'Wallet loan fund',
        purpose: 'Mobile loan regression funding',
        amount: 200,
        date: today,
        payment_method: 'mobile_banking',
        mobile_wallet_id: wallet.id,
        status: 'posted',
        created_by: user.id,
      }).returning('*');
      const before = await treasury.mobileWalletBalance(wallet.id, today);
      loan = await loans.create({
        borrower_name: `Wallet Loan ${Date.now()}`,
        purpose: 'Mobile wallet regression',
        principal_amount: 100,
        issue_date: today,
        payment_method: 'mobile_banking',
        mobile_wallet_id: wallet.id,
      }, user.id);
      expect(Number(loan.mobile_wallet_id)).toBe(wallet.id);
      expect(await treasury.mobileWalletBalance(wallet.id, today)).toBe(before - 100);
      await loans.repay(loan.id, {
        amount: 40,
        payment_date: today,
        payment_method: 'mobile_banking',
        mobile_wallet_id: wallet.id,
      }, user.id);
      const updated = await loans.find(loan.id);
      expect(Number(updated.repayments[0].mobile_wallet_id)).toBe(wallet.id);
      expect(await treasury.mobileWalletBalance(wallet.id, today)).toBe(before - 60);
    } finally {
      if (loan) {
        await db('loan_repayments').where({ loan_id: loan.id }).del();
        await db('mosque_loans').where({ id: loan.id }).del();
      }
      if (fund) await db('collections').where({ id: fund.id }).del();
    }
  });

  test('loan cancellation restores funds and is blocked after a repayment', async () => {
    const user = await db('users').where({ username: 'admin' }).first();
    const wallet = await db('mobile_wallets').where({ provider: 'bkash', is_active: true }).first();
    const today = '2026-07-23';
    let fund; let cancellable; let repaid;
    try {
      [fund] = await db('collections').insert({
        payer_name: 'Cancellation test fund',
        purpose: 'Loan cancellation regression',
        amount: 300,
        date: today,
        payment_method: 'mobile_banking',
        mobile_wallet_id: wallet.id,
        status: 'posted',
        created_by: user.id,
      }).returning('*');
      const before = await treasury.mobileWalletBalance(wallet.id, today);
      cancellable = await loans.create({
        borrower_name: `Cancelled Wallet Loan ${Date.now()}`,
        purpose: 'Cancellation regression',
        principal_amount: 80,
        issue_date: today,
        payment_method: 'mobile_banking',
        mobile_wallet_id: wallet.id,
      }, user.id);
      expect(await treasury.mobileWalletBalance(wallet.id, today)).toBe(before - 80);
      await loans.cancel(cancellable.id, 'Entered twice', user.id);
      expect((await loans.find(cancellable.id)).status).toBe('cancelled');
      expect(await treasury.mobileWalletBalance(wallet.id, today)).toBe(before);

      repaid = await loans.create({
        borrower_name: `Repaid Wallet Loan ${Date.now()}`,
        purpose: 'Cancellation guard regression',
        principal_amount: 100,
        issue_date: today,
        payment_method: 'mobile_banking',
        mobile_wallet_id: wallet.id,
      }, user.id);
      await loans.repay(repaid.id, {
        amount: 10,
        payment_date: today,
        payment_method: 'mobile_banking',
        mobile_wallet_id: wallet.id,
      }, user.id);
      await expect(loans.cancel(repaid.id, 'Should fail', user.id)).rejects.toThrow('repayments');
      expect((await loans.find(repaid.id)).status).toBe('active');
    } finally {
      for (const loan of [repaid, cancellable]) {
        if (!loan) continue;
        await db('loan_repayments').where({ loan_id: loan.id }).del();
        await db('mosque_loans').where({ id: loan.id }).del();
      }
      if (fund) await db('collections').where({ id: fund.id }).del();
    }
  });

  test('reversing a loan repayment restores receivable and treasury balances', async () => {
    const user = await db('users').where({ username: 'admin' }).first();
    const wallet = await db('mobile_wallets').where({ provider: 'bkash', is_active: true }).first();
    const today = '2026-07-24';
    let fund; let loan; let repayment;
    try {
      [fund] = await db('collections').insert({
        payer_name: 'Repayment reversal fund',
        purpose: 'Repayment reversal regression',
        amount: 200,
        date: today,
        payment_method: 'mobile_banking',
        mobile_wallet_id: wallet.id,
        status: 'posted',
        created_by: user.id,
      }).returning('*');
      const before = await treasury.mobileWalletBalance(wallet.id, today);
      loan = await loans.create({
        borrower_name: `Reversal Loan ${Date.now()}`,
        purpose: 'Repayment reversal regression',
        principal_amount: 100,
        issue_date: today,
        payment_method: 'mobile_banking',
        mobile_wallet_id: wallet.id,
      }, user.id);
      await loans.repay(loan.id, {
        amount: 40,
        payment_date: today,
        payment_method: 'mobile_banking',
        mobile_wallet_id: wallet.id,
      }, user.id);
      repayment = await db('loan_repayments').where({ loan_id: loan.id, status: 'posted' }).first();
      expect(await treasury.mobileWalletBalance(wallet.id, today)).toBe(before - 60);
      await loans.cancelRepayment(repayment.id, 'Entered against wrong borrower', user.id);
      const corrected = await loans.find(loan.id);
      expect(Number(corrected.repaid_amount)).toBe(0);
      expect(corrected.status).toBe('active');
      expect(corrected.repayments[0].status).toBe('cancelled');
      expect(await treasury.mobileWalletBalance(wallet.id, today)).toBe(before - 100);
      await loans.cancel(loan.id, 'Loan was entered against wrong borrower', user.id);
      expect(await treasury.mobileWalletBalance(wallet.id, today)).toBe(before);
    } finally {
      if (loan) {
        await db('loan_repayments').where({ loan_id: loan.id }).del();
        await db('mosque_loans').where({ id: loan.id }).del();
      }
      if (fund) await db('collections').where({ id: fund.id }).del();
    }
  });

  test('pledge payment creates a receipt and cancellation restores the due', async () => {
    const user = await db('users').where({ username: 'admin' }).first();
    let pledge, receipt, bank;
    try {
      [bank] = await db('banks').insert({ name: `Trace bank ${Date.now()}`, is_active: true }).returning('*');
      pledge = await pledges.create({ donor_name: `Pledge Test ${Date.now()}`, purpose: 'Regression', pledged_amount: 200, pledge_date: '2026-07-21' }, user.id);
      await expect(pledges.pay(pledge.id, { amount: 75, payment_date: '2026-07-21', payment_method: 'bank' }, user.id)).rejects.toThrow('active bank');
      receipt = await pledges.pay(pledge.id, { amount: 75, payment_date: '2026-07-21', payment_method: 'bank', bank_id: bank.id }, user.id);
      expect(Number(receipt.bank_id)).toBe(bank.id);
      const partial = await pledges.find(pledge.id);
      expect(partial.status).toBe('partial');
      expect(Number(partial.paid_amount)).toBe(75);
      expect(partial.payments[0].receipt_no).toMatch(/^RCPT-/);
      await collections.cancel(receipt.id, { cancelled_by: user.id, cancellation_reason: 'Regression reversal' });
      const reversed = await pledges.find(pledge.id);
      expect(reversed.status).toBe('active');
      expect(Number(reversed.paid_amount)).toBe(0);
      expect(reversed.payments[0].status).toBe('cancelled');
    } finally {
      if (receipt) { await db('pledge_payments').where({ collection_id: receipt.id }).del(); await db('collections').where({ id: receipt.id }).del(); }
      if (pledge) await db('donation_pledges').where({ id: pledge.id }).del();
      if (bank) await db('banks').where({ id: bank.id }).del();
    }
  });
});

describe('Recurring task workflow', () => {
  test('completing a recurring task creates the next occurrence and copies its checklist', async () => {
    const user = await db('users').where({ username: 'admin' }).first();
    let original, next;
    try {
      original = await tasks.create({ title: `Recurring Test ${Date.now()}`, category: 'general', priority: 'normal', start_date: '2026-07-01', due_date: '2026-07-31', recurrence_type: 'monthly', recurrence_interval: 1 }, user.id);
      await tasks.addChecklist(original.id, 'Verify recurring checklist', user.id);
      next = await tasks.updateStatus(original.id, 'completed', 'Regression completion', user.id);
      expect(next).toBeTruthy();
      const nextDue = next.due_date instanceof Date ? `${next.due_date.getFullYear()}-${String(next.due_date.getMonth() + 1).padStart(2, '0')}-${String(next.due_date.getDate()).padStart(2, '0')}` : String(next.due_date).slice(0, 10);
      expect(nextDue).toBe('2026-08-31');
      expect(next.parent_task_id).toBe(original.id);
      const copied = await db('mosque_task_checklist_items').where({ task_id: next.id }).first();
      expect(copied.title).toBe('Verify recurring checklist');
      expect(copied.is_completed).toBe(false);
    } finally {
      if (next) await db('mosque_tasks').where({ id: next.id }).del();
      if (original) await db('mosque_tasks').where({ id: original.id }).del();
    }
  });
});

describe('Task template workflow', () => {
  test('a saved template creates a dated task with its checklist', async () => {
    const user = await db('users').where({ username: 'admin' }).first();
    let template, task;
    try {
      template = await taskTemplates.create({ name: `Template Test ${Date.now()}`, category: 'facility', priority: 'high', default_duration_days: 3, checklist: 'First step\nSecond step' }, user.id);
      task = await taskTemplates.instantiate(template.id, { start_date: '2026-07-22' }, user.id);
      const detail = await tasks.find(task.id);
      const due = detail.due_date instanceof Date ? `${detail.due_date.getFullYear()}-${String(detail.due_date.getMonth() + 1).padStart(2, '0')}-${String(detail.due_date.getDate()).padStart(2, '0')}` : String(detail.due_date).slice(0, 10);
      expect(due).toBe('2026-07-25');
      expect(detail.priority).toBe('high');
      expect(detail.checklist.map((item) => item.title)).toEqual(['First step', 'Second step']);
    } finally {
      if (task) await db('mosque_tasks').where({ id: task.id }).del();
      if (template) await db('mosque_task_templates').where({ id: template.id }).del();
    }
  });
});

describe('Personal task notifications', () => {
  test('an assigned task is unread until the user opens its reminder', async () => {
    const user = await db('users').where({ username: 'admin' }).first(); let task;
    try {
      task = await tasks.create({ title: `Notification Test ${Date.now()}`, category: 'general', priority: 'high', assigned_user_id: user.id, due_date: '2026-07-22', recurrence_type: 'none' }, user.id);
      const before = await notifications.list(user);
      const reminder = before.items.find((item) => item.key.startsWith(`task:${task.id}:`));
      expect(reminder).toBeTruthy(); expect(reminder.unread).toBe(true); expect(reminder.href).toBe(`/tasks/${task.id}`);
      await notifications.markRead(user, reminder.key);
      const after = await notifications.list(user);
      expect(after.items.find((item) => item.key === reminder.key).unread).toBe(false);
    } finally {
      if (task) { await db('user_notification_states').where({ user_id: user.id }).where('notification_key', 'like', `task:${task.id}:%`).del(); await db('mosque_tasks').where({ id: task.id }).del(); }
    }
  });
});

describe('Personal dashboard preferences', () => {
  test('dashboard reporting accepts a validated historical month', async () => {
    const historical = await reports.dashboard('2025-02');
    expect(historical.monthValue).toBe('2025-02');
    expect(historical.previousMonthValue).toBe('2025-01');
    expect(historical.nextMonthValue).toBe('2025-03');
    expect(historical.comparison).toEqual(expect.objectContaining({ previousCollection: expect.any(Number), previousExpense: expect.any(Number), previousBalance: expect.any(Number) }));
    expect(historical.chartData).toHaveLength(6);
    const fallback = await reports.dashboard('not-a-month');
    expect(fallback.monthValue).toMatch(/^\d{4}-\d{2}$/);
  });

  test('visible dashboard sections are saved separately for a user', async () => {
    const user = await db('users').where({ username: 'admin' }).first();
    try {
      const saved = await dashboardPreferences.saveLayout(user.id, ['welcome', 'stats'], ['stats', 'welcome', 'invalid']);
      expect(saved.hidden).toEqual(expect.arrayContaining(['controls', 'performance', 'schedule']));
      expect(saved.order).toEqual(['stats', 'welcome', 'controls', 'performance', 'schedule']);
      const loaded = await dashboardPreferences.get(user.id);
      expect(loaded.hidden).toEqual(saved.hidden);
      expect(loaded.order).toEqual(saved.order);
      expect(loaded.hidden).not.toContain('welcome'); expect(loaded.hidden).not.toContain('stats');
    } finally { await db('user_dashboard_preferences').where({ user_id: user.id }).del(); }
  });
});

describe('Landing content publishing', () => {
  test('upload cleanup only resolves safe local upload paths', () => {
    expect(uploadedFilePath('/uploads/gallery.jpg')).toMatch(/gallery\.jpg$/);
    expect(uploadedFilePath('https://example.com/gallery.jpg')).toBeNull();
    expect(uploadedFilePath('/uploads/../server.js')).toBeNull();
    expect(uploadedFilePath('/static/gallery.jpg')).toBeNull();
  });

  test('storage maintenance recognizes only safe upload references', () => {
    expect(uploadStorage.filenameFromPublicPath('/uploads/photo-safe.jpg')).toBe('photo-safe.jpg');
    expect(uploadStorage.filenameFromPublicPath('/uploads/folder/photo.jpg')).toBeNull();
    expect(uploadStorage.filenameFromPublicPath('https://example.com/photo.jpg')).toBeNull();
    expect(uploadStorage.isSafeFilename('../photo.jpg')).toBe(false);
  });

  test('gallery forms do not persist the CSRF transport field', async () => {
    let image;
    try {
      image = await landingGallery.create({
        _csrf: 'test-token',
        title_bn: `গ্যালারি ${Date.now()}`,
        title_en: `Gallery ${Date.now()}`,
        image_path: '/uploads/test-gallery.jpg',
        category: 'Events',
        sort_order: '1',
        is_active: 'on',
      });
      const updated = await landingGallery.update(image.id, {
        _csrf: 'updated-test-token',
        title_bn: image.title_bn,
        title_en: 'Updated gallery',
        image_path: image.image_path,
        category: image.category,
        sort_order: '2',
        is_active: 'on',
      });
      expect(updated.title_en).toBe('Updated gallery');
      expect(updated.sort_order).toBe(2);
    } finally {
      if (image) await db('gallery_images').where({ id: image.id }).del();
    }
  });

  test('gallery images can be moved without editing each record', async () => {
    const created = [];
    try {
      created.push(await landingGallery.create({
        title_bn: `প্রথম ${Date.now()}`,
        title_en: 'First order',
        image_path: '/uploads/first-order.jpg',
        category: 'Events',
        sort_order: '1000',
        is_active: 'on',
      }));
      created.push(await landingGallery.create({
        title_bn: `দ্বিতীয় ${Date.now()}`,
        title_en: 'Second order',
        image_path: '/uploads/second-order.jpg',
        category: 'Events',
        sort_order: '1001',
        is_active: 'on',
      }));
      await landingGallery.move(created[1].id, 'up');
      const ordered = await landingGallery.list();
      expect(ordered.findIndex((item) => item.id === created[1].id))
        .toBeLessThan(ordered.findIndex((item) => item.id === created[0].id));
    } finally {
      if (created.length) await db('gallery_images').whereIn('id', created.map((item) => item.id)).del();
    }
  });

  test('event end time must be later than its start time', async () => {
    await expect(landingEvents.create({
      title_bn: 'ভুল সময়',
      title_en: 'Invalid time',
      event_date: '2026-08-03',
      event_time: '11:00',
      end_time: '10:00',
      category: 'Education',
      location: 'Test',
      is_active: 'on',
    })).rejects.toThrow('শেষের সময় শুরুর সময়ের পরে হতে হবে');
  });

  test('recurring events cannot end before their first date', async () => {
    await expect(landingEvents.create({
      title_bn: 'ভুল পুনরাবৃত্তি',
      title_en: 'Invalid recurrence',
      event_date: '2026-08-10',
      event_time: '10:00',
      category: 'Education',
      location: 'Test',
      recurrence_type: 'weekly',
      recurrence_until: '2026-08-03',
      is_active: 'on',
    })).rejects.toThrow('শেষ তারিখ অনুষ্ঠানের তারিখের আগে হতে পারবে না');
  });

  test('event management filters recurring drafts', async () => {
    let event;
    try {
      event = await landingEvents.create({
        title_bn: `ফিল্টার ${Date.now()}`,
        title_en: `Filter ${Date.now()}`,
        event_date: '2026-08-10',
        event_time: '10:00',
        category: 'Education',
        location: 'Test',
        recurrence_type: 'monthly',
        recurrence_until: '2026-12-10',
        is_active: 'on',
      });
      const rows = await landingEvents.list({ recurrence: 'monthly', status: 'draft' });
      expect(rows.some((item) => item.id === event.id)).toBe(true);
      const weeklyRows = await landingEvents.list({ recurrence: 'weekly', status: 'draft' });
      expect(weeklyRows.some((item) => item.id === event.id)).toBe(false);
    } finally {
      if (event) await db('events').where({ id: event.id }).del();
    }
  });

  test('weekly events expand into date-wise public calendar occurrences', async () => {
    const user = await db('users').where({ username: 'admin' }).first(); let event;
    try {
      event = await landingEvents.create({ title_bn: `সাপ্তাহিক ${Date.now()}`, title_en: `Weekly ${Date.now()}`, description_bn: 'সাপ্তাহিক অনুষ্ঠান', description_en: 'Weekly event', category: 'Education', event_date: '2026-08-03', event_time: '10:00', end_time: '11:30', location: 'Test', recurrence_type: 'weekly', recurrence_until: '2026-08-17', is_active: 'on' });
      await landingPublishing.setStatus('events', event.id, 'published', user.id);
      const response = await request(app).get('/api/events').expect(200);
      const occurrences = response.body.events.filter((item) => item.id === event.id);
      expect(occurrences.map((item) => item.event_date)).toEqual(['2026-08-03', '2026-08-10', '2026-08-17']);
      expect(occurrences.map((item) => item.occurrence_key)).toEqual([`${event.id}:2026-08-03`, `${event.id}:2026-08-10`, `${event.id}:2026-08-17`]);
      expect(occurrences.every((item) => item.end_time === '11:30')).toBe(true);
      const adminCalendar = await unifiedCalendar.get('2026-08', 'admin');
      const adminOccurrences = adminCalendar.entries.filter((item) => item.id.startsWith(`event-${event.id}-`));
      expect(adminOccurrences.map((item) => item.date)).toEqual(['2026-08-03', '2026-08-10', '2026-08-17']);
      expect(adminOccurrences.every((item) => item.endTime === '11:30')).toBe(true);
    } finally { if (event) { await db('landing_publication_events').where({ content_type: 'events', content_id: event.id }).del(); await db('events').where({ id: event.id }).del(); } }
  });

  test('content duplication creates an independent unpublished draft', async () => {
    const user = await db('users').where({ username: 'admin' }).first(); let source, copy;
    try {
      source = await landingEvents.create({ title_bn: `মূল ${Date.now()}`, title_en: `Original ${Date.now()}`, description_bn: 'সম্পূর্ণ বিবরণ', description_en: 'Complete description', category: 'general', event_date: '2026-08-01', event_time: '10:00', location: 'Test', is_active: 'on' });
      await landingPublishing.setStatus('events', source.id, 'published', user.id);
      copy = (await landingPublishing.duplicate('events', source.id, user.id)).item;
      expect(copy.id).not.toBe(source.id);
      expect(copy.title_en).toBe(`${source.title_en} (Copy)`);
      expect(copy.publication_status).toBe('draft');
      expect(copy.scheduled_at).toBeNull(); expect(copy.expires_at).toBeNull(); expect(copy.review_status).toBe('draft');
      expect((await landingEvents.listActive()).some((item) => item.id === copy.id)).toBe(false);
      expect((await landingPublishing.history({ type: 'events', action: 'duplicated', q: source.title_bn })).some((item) => item.content_id === copy.id)).toBe(true);
    } finally {
      for (const item of [copy, source].filter(Boolean)) { await db('landing_publication_events').where({ content_type: 'events', content_id: item.id }).del(); await db('events').where({ id: item.id }).del(); }
    }
  });

  test('published content is automatically removed when its expiry time arrives', async () => {
    const user = await db('users').where({ username: 'admin' }).first(); let event;
    try {
      event = await landingEvents.create({ title_bn: `মেয়াদ ${Date.now()}`, title_en: `Expiry ${Date.now()}`, description_bn: 'সম্পূর্ণ বিবরণ', description_en: 'Complete description', category: 'general', event_date: '2026-08-01', event_time: '10:00', location: 'Test', is_active: 'on' });
      await landingPublishing.setStatus('events', event.id, 'published', user.id);
      await landingPublishing.setExpiry('events', event.id, new Date(Date.now() + 3600000), user.id);
      await db('events').where({ id: event.id }).update({ expires_at: new Date(Date.now() - 1000) });
      expect(await landingPublishing.publishDue()).toBe(1);
      const expired = await landingEvents.find(event.id);
      expect(expired.publication_status).toBe('expired');
      expect((await landingEvents.listActive()).some((item) => item.id === event.id)).toBe(false);
      const audit = await landingPublishing.history({ type: 'events', action: 'automatic_unpublish', q: event.title_bn });
      expect(audit).toHaveLength(1);
    } finally { if (event) { await db('landing_publication_events').where({ content_type: 'events', content_id: event.id }).del(); await db('events').where({ id: event.id }).del(); } }
  });

  test('incomplete bilingual content cannot be published', async () => {
    const user = await db('users').where({ username: 'admin' }).first(); let event;
    try {
      event = await landingEvents.create({ title_bn: `অসম্পূর্ণ ${Date.now()}`, title_en: `Incomplete ${Date.now()}`, category: 'general', event_date: '2026-08-01', event_time: '10:00', location: 'Test', is_active: 'on' });
      expect(landingPublishing.publicationIssues('events', event)).toEqual(expect.arrayContaining(['বাংলা বিবরণ', 'English description']));
      const incomplete = await landingPublishing.list({ q: event.title_en, status: 'incomplete', per_page: 10 });
      expect(incomplete.items.map((item) => item.id)).toContain(event.id);
      expect(incomplete.pagination.perPage).toBe(10);
      const cmsOverview = await landingPublishing.overview();
      expect(cmsOverview.summary.incomplete).toBeGreaterThan(0);
      expect(cmsOverview.attention.some((item) => item.type === 'events' && item.id === event.id)).toBe(true);
      await expect(landingPublishing.setStatus('events', event.id, 'published', user.id)).rejects.toThrow('Complete the content before publishing');
      expect((await landingEvents.find(event.id)).publication_status).toBe('draft');
    } finally { if (event) await db('events').where({ id: event.id }).del(); }
  });

  test('draft content is hidden from the public feed until published', async () => {
    const user = await db('users').where({ username: 'admin' }).first(); let event;
    try {
      event = await landingEvents.create({ title_bn: `খসড়া ${Date.now()}`, title_en: `Draft ${Date.now()}`, description_bn: 'পরীক্ষা', description_en: 'Test', category: 'general', event_date: '2026-08-01', event_time: '10:00', location: 'Test', is_active: 'on' });
      expect(event.publication_status).toBe('draft');
      expect((await landingEvents.listActive()).some((item) => item.id === event.id)).toBe(false);
      const preview = await landingPublishing.preview('events', event.id);
      expect(preview.item.title_en).toBe(event.title_en);
      const filtered = await landingPublishing.list({ q: event.title_en, type: 'events', status: 'draft' });
      expect(filtered.items.map((item) => item.id)).toContain(event.id);
      expect(filtered.items.every((item) => item.type === 'events' && item.status === 'draft')).toBe(true);
      await landingPublishing.requestReview('events', event.id, user.id);
      expect((await landingEvents.find(event.id)).review_status).toBe('submitted');
      const publisherNotifications = await notifications.list(user);
      expect(publisherNotifications.items.some((item) => item.key.startsWith(`content-review:events:${event.id}:submitted:`) && item.href.endsWith('/preview'))).toBe(true);
      await landingPublishing.requestChanges('events', event.id, 'Clarify the event location', user.id);
      expect((await landingEvents.find(event.id)).review_status).toBe('changes_requested');
      const editorNotifications = await notifications.list(user);
      expect(editorNotifications.items.some((item) => item.key.startsWith(`content-review:events:${event.id}:changes:`) && item.severity === 'warning')).toBe(true);
      await landingEvents.update(event.id, { title_bn: event.title_bn, title_en: event.title_en, description_bn: 'পরীক্ষা', description_en: 'Test', category: 'general', event_date: '2026-08-01', event_time: '10:00', location: 'Test', is_active: 'on' });
      expect((await landingEvents.find(event.id)).review_status).toBe('draft');
      const bulk = await landingPublishing.bulkSetStatus([`events:${event.id}`], 'published', user.id);
      expect(bulk).toEqual({ selected: 1, changed: 1 });
      expect((await landingEvents.listActive()).some((item) => item.id === event.id)).toBe(true);
      await landingPublishing.setStatus('events', event.id, 'scheduled', user.id, new Date(Date.now() + 3600000));
      expect((await landingEvents.listActive()).some((item) => item.id === event.id)).toBe(false);
      await db('events').where({ id: event.id }).update({ scheduled_at: new Date(Date.now() - 1000) });
      expect(await landingPublishing.publishDue()).toBe(1);
      expect((await landingEvents.listActive()).some((item) => item.id === event.id)).toBe(true);
      const audit = (await landingPublishing.history()).filter((item) => item.content_type === 'events' && item.content_id === event.id);
      const statusAudit = audit.filter((item) => ['status_change', 'automatic_publish'].includes(item.action));
      expect(statusAudit).toHaveLength(3);
      expect(statusAudit.map((item) => item.new_status)).toEqual(['published', 'scheduled', 'published']);
      expect(statusAudit[0].actor_username).toBeNull();
      expect(statusAudit[1].actor_username).toBe('admin');
      expect(audit.some((item) => item.action === 'review_requested')).toBe(true);
      expect(audit.some((item) => item.action === 'changes_requested')).toBe(true);
      const filteredHistory = await landingPublishing.history({ q: event.title_bn, type: 'events', action: 'changes_requested' });
      expect(filteredHistory).toHaveLength(1);
      expect(filteredHistory[0].snapshot.review_notes).toBe('Clarify the event location');
      const changeDetail = await landingPublishing.historyDetail(filteredHistory[0].id);
      expect(changeDetail.event.actor_username).toBe('admin');
      expect(changeDetail.changes).toEqual(expect.arrayContaining([expect.objectContaining({ key: 'review_notes', before: '', after: 'Clarify the event location' }), expect.objectContaining({ key: 'review_status', before: 'submitted', after: 'changes_requested' })]));
      await db('events').where({ id: event.id }).update({ title_en: 'Accidental overwrite' });
      await landingPublishing.restore(statusAudit[1].id, user.id);
      const restored = await landingEvents.find(event.id);
      expect(restored.title_en).toBe(event.title_en);
      expect(restored.publication_status).toBe('draft');
      const restoreAudit = (await landingPublishing.history()).find((item) => item.content_type === 'events' && item.content_id === event.id && item.action === 'restore');
      expect(restoreAudit).toBeTruthy();
      expect(landingPublishing.historyCsv([restoreAudit])).toContain(event.title_bn);
      await landingPublishing.setStatus('events', event.id, 'published', user.id);
      await landingEvents.update(event.id, { title_bn: event.title_bn, title_en: 'Reviewed edit', description_bn: 'পরীক্ষা', description_en: 'Test', category: 'general', event_date: '2026-08-01', event_time: '10:00', location: 'Test', is_active: 'on' });
      const edited = await landingEvents.find(event.id);
      expect(edited.publication_status).toBe('draft');
      expect((await landingEvents.listActive()).some((item) => item.id === event.id)).toBe(false);
    } finally {
      if (event) {
        await db('landing_publication_events').where({ content_type: 'events', content_id: event.id }).del();
        await db('events').where({ id: event.id }).del();
      }
    }
  });

  test('archived content can be filtered and restored in bulk as drafts', async () => {
    const user = await db('users').where({ username: 'admin' }).first(); const created = [];
    try {
      for (const suffix of ['One', 'Two']) created.push(await landingEvents.create({ title_bn: `আর্কাইভ ${suffix} ${Date.now()}`, title_en: `Archive ${suffix} ${Date.now()}`, description_bn: 'সম্পূর্ণ বিবরণ', description_en: 'Complete description', category: 'general', event_date: '2026-08-01', event_time: '10:00', location: 'Test', is_active: 'on' }));
      for (const event of created) { await landingPublishing.setStatus('events', event.id, 'published', user.id); await landingPublishing.archive('events', event.id, user.id); }
      expect(await landingEvents.find(created[0].id)).toBeUndefined();
      const result = await landingPublishing.archived({ q: 'Archive', type: 'events', per_page: 10 });
      expect(result.items.map((item) => item.id)).toEqual(expect.arrayContaining(created.map((item) => item.id)));
      expect(result.filters.type).toBe('events'); expect(result.pagination.page).toBe(1);
      await landingPublishing.restoreArchivedBulk(created.map((item) => `events:${item.id}`), user.id);
      for (const event of created) { const restored = await landingEvents.find(event.id); expect(restored.publication_status).toBe('draft'); expect(restored.deleted_at).toBeNull(); }
      const audit = await landingPublishing.history({ type: 'events', action: 'archive_restored', q: 'আর্কাইভ' });
      expect(audit.filter((item) => created.some((event) => event.id === item.content_id))).toHaveLength(2);
    } finally {
      for (const event of created) { await db('landing_publication_events').where({ content_type: 'events', content_id: event.id }).del(); await db('events').where({ id: event.id }).del(); }
    }
  });

  test('pending expenses do not move funds until an administrator approves them', async () => {
    const admin = await db('users').where({ username: 'admin' }).first();
    const head = await db('expense_heads').first();
    const created = [];
    try {
      const before = await expenses.total();
      const pending = await expenses.create({
        expense_head_id: head.id,
        purpose: 'Approval workflow test',
        amount: 1,
        date: '2026-07-20',
        payment_method: 'cash',
        created_by: admin.id,
        submitted_by: admin.id,
        status: 'pending',
      });
      created.push(pending.id);
      expect(pending.status).toBe('pending');
      expect(await expenses.total()).toBe(before);

      const approved = await expenses.decide(pending.id, 'approve', 'Approved for test', admin.id);
      expect(approved.status).toBe('posted');
      expect(Number(await expenses.total())).toBeCloseTo(before + 1);
      await expect(expenses.decide(pending.id, 'approve', '', admin.id))
        .rejects.toThrow('Only a pending expense can be reviewed');

      const rejected = await expenses.create({
        expense_head_id: head.id,
        purpose: 'Rejected workflow test',
        amount: 1,
        date: '2026-07-20',
        payment_method: 'cash',
        created_by: admin.id,
        submitted_by: admin.id,
        status: 'pending',
      });
      created.push(rejected.id);
      expect((await expenses.decide(rejected.id, 'reject', 'Not authorized', admin.id)).status)
        .toBe('rejected');
      expect(Number(await expenses.total())).toBeCloseTo(before + 1);
    } finally {
      if (created.length) await db('expenses').whereIn('id', created).del();
    }
  });

  test('expense approval requires a documented override when a configured budget is exceeded', async () => {
    const admin = await db('users').where({ username: 'admin' }).first();
    const head = await db('expense_heads').first();
    let target; let line; let pending;
    try {
      [target] = await db('management_targets').insert({ target_month: '2098-10-01', updated_by: admin.id }).returning('*');
      [line] = await db('budget_lines').insert({ management_target_id: target.id, line_type: 'expense', expense_head_id: head.id, budget_amount: 10, updated_by: admin.id }).returning('*');
      pending = await expenses.create({ expense_head_id: head.id, purpose: 'Budget override regression', amount: 11, date: '2098-10-20', payment_method: 'cash', created_by: admin.id, submitted_by: admin.id, status: 'pending' });
      await expect(expenses.decide(pending.id, 'approve', '', admin.id)).rejects.toThrow('exceeds this budget line');
      expect((await expenses.find(pending.id)).status).toBe('pending');
      const approved = await expenses.decide(pending.id, 'approve', 'Emergency purchase', admin.id, { budget_override_reason: 'Safety-critical emergency' });
      expect(approved.status).toBe('posted');
      expect(approved.budget_override_reason).toBe('Safety-critical emergency');
      expect(Number(approved.budget_amount_at_approval)).toBe(10);
      expect(Number(approved.budget_spent_before)).toBe(0);
    } finally {
      if (pending) await db('expenses').where({ id: pending.id }).del();
      if (line) await db('budget_lines').where({ id: line.id }).del();
      if (target) await db('management_targets').where({ id: target.id }).del();
    }
  });

  test('an administrator-created manual expense remains pending and uses a second approver when available', async () => {
    const admin = await db('users').where({ username: 'admin' }).first();
    const head = await db('expense_heads').first();
    let expense; let secondAdmin;
    try {
      const purpose = `Admin pending expense ${Date.now()}`;
      expense = await expenses.create({ expense_head_id: head.id, purpose, amount: 1, date: '2026-07-20', payment_method: 'cash', created_by: admin.id, submitted_by: admin.id, status: 'pending' });
      expect(expense.status).toBe('pending');

      [secondAdmin] = await db('users').insert({ name: 'Second approval administrator', username: `second_admin_${Date.now()}`, password_hash: admin.password_hash, role: 'admin', is_active: true }).returning('*');
      await expect(expenses.decide(expense.id, 'approve', '', admin.id)).rejects.toThrow('Another administrator');
      expect((await expenses.decide(expense.id, 'approve', 'Independently reviewed', secondAdmin.id)).status).toBe('posted');
    } finally {
      if (expense) await db('expenses').where({ id: expense.id }).del();
      if (secondAdmin) await db('users').where({ id: secondAdmin.id }).del();
    }
  });

  test('loan applications do not disburse funds until approved', async () => {
    const admin = await db('users').where({ username: 'admin' }).first();
    let application;
    try {
      const cashBefore = await treasury.cashBalance('2026-07-20');
      const summaryBefore = await loans.summary();
      application = await loans.submit({
        borrower_name: 'Approval Test Borrower',
        purpose: 'Emergency support',
        principal_amount: 1,
        issue_date: '2026-07-20',
        payment_method: 'cash',
      }, admin.id);
      expect(application.status).toBe('pending');
      expect(await treasury.cashBalance('2026-07-20')).toBe(cashBefore);
      expect((await loans.summary()).issued).toBe(summaryBefore.issued);

      const approved = await loans.decide(application.id, 'approve', 'Committee approved', admin.id);
      expect(approved.status).toBe('active');
      expect(await treasury.cashBalance('2026-07-20')).toBeCloseTo(cashBefore - 1);
      expect((await loans.summary()).issued).toBeCloseTo(summaryBefore.issued + 1);
      await expect(loans.decide(application.id, 'approve', '', admin.id))
        .rejects.toThrow('Only a pending loan can be reviewed');
    } finally {
      if (application) await db('mosque_loans').where({ id: application.id }).del();
    }
  });

  test('welfare release requests require a second decision before funds move', async () => {
    const admin = await db('users').where({ username: 'admin' }).first();
    let beneficiary; let application; let release; let expenseId; let budgetTarget; let budgetLine;
    try {
      beneficiary = await welfare.createBeneficiary({ name: 'Two Step Welfare Test' }, admin.id);
      await welfare.verifyBeneficiary(beneficiary.id, 'eligible', 'Verified for test', admin.id);
      application = await welfare.createApplication({ beneficiary_id: beneficiary.id, assistance_type: 'food', fund_source: 'general', reason: 'Workflow test', requested_amount: 2, urgency: 'normal' }, admin.id);
      await welfare.decide(application.id, { status: 'approved', approved_amount: 2, decision_notes: 'Approved application' }, admin.id);
      const welfareHead = await db('expense_heads').where({ name: 'কল্যাণ ও সহায়তা' }).first();
      [budgetTarget] = await db('management_targets').insert({ target_month: '2098-12-01', updated_by: admin.id }).returning('*');
      [budgetLine] = await db('budget_lines').insert({ management_target_id: budgetTarget.id, line_type: 'expense', expense_head_id: welfareHead.id, budget_amount: 0, updated_by: admin.id }).returning('*');
      const cashBefore = await treasury.cashBalance('2098-12-20');
      release = await welfare.requestDisbursement(application.id, { amount: 1, disbursement_date: '2098-12-20', payment_method: 'cash', remarks: 'Release request' }, admin.id);
      expect(release.status).toBe('pending');
      expect(await treasury.cashBalance('2098-12-20')).toBe(cashBefore);
      expect(Number((await welfare.find(application.id)).disbursed_amount)).toBe(0);
      await expect(welfare.requestDisbursement(application.id, { amount: 2, disbursement_date: '2098-12-20', payment_method: 'cash' }, admin.id)).rejects.toThrow('unreserved approved balance');

      await expect(welfare.decideDisbursement(release.id, 'approve', 'Release approved', admin.id)).rejects.toThrow('exceeds its budget line');
      await welfare.decideDisbursement(release.id, 'approve', 'Release approved', admin.id, { budget_override_reason: 'Emergency welfare support' });
      const completed = await welfare.find(application.id);
      expect(Number(completed.disbursed_amount)).toBe(1);
      expect(completed.disbursementRequests[0].status).toBe('approved');
      expect(Number(completed.disbursementRequests[0].disbursement_id)).toBe(Number(completed.disbursements[0].id));
      expect(await treasury.cashBalance('2098-12-20')).toBeCloseTo(cashBefore - 1);
      expenseId = completed.disbursements[0].expense_id;
      await expect(welfare.decideDisbursement(release.id, 'approve', '', admin.id)).rejects.toThrow('Only a pending disbursement can be decided');
      await expenses.cancel(expenseId, { cancelled_by: admin.id, cancellation_reason: 'Atomic welfare reversal' });
      const reversed = await welfare.find(application.id);
      expect(reversed.disbursementRequests[0].status).toBe('cancelled');
      expect(Number(reversed.disbursed_amount)).toBe(0);
      expect(await treasury.cashBalance('2098-12-20')).toBeCloseTo(cashBefore);
    } finally {
      if (release) await db('welfare_disbursement_requests').where({ id: release.id }).del();
      if (application) await db('welfare_disbursements').where({ application_id: application.id }).del();
      if (expenseId) await db('expenses').where({ id: expenseId }).del();
      if (application) await db('welfare_applications').where({ id: application.id }).del();
      if (beneficiary) await db('welfare_beneficiaries').where({ id: beneficiary.id }).del();
      if (budgetLine) await db('budget_lines').where({ id: budgetLine.id }).del();
      if (budgetTarget) await db('management_targets').where({ id: budgetTarget.id }).del();
    }
  });

  test('user accounts are deactivated without deleting their history and can be restored', async () => {
    const admin = await db('users').where({ username: 'admin' }).first();
    const username = `lifecycle_${Date.now()}`;
    let user;
    try {
      user = await users.create({
        name: 'Lifecycle User',
        username,
        email: null,
        password: 'Lifecycle@123',
        role: 'collector',
        is_active: true,
      });
      const existingSession = await loginAs(username, 'Lifecycle@123');
      expect((await existingSession.get('/dashboard')).status).toBe(200);
      await users.setActive(user.id, false, admin.id);
      expect((await users.findById(user.id)).is_active).toBe(false);
      const expiredSession = await existingSession.get('/dashboard');
      expect(expiredSession.status).toBe(302);
      expect(expiredSession.headers.location).toBe('/login');

      const agent = request.agent(app);
      const loginPage = await agent.get('/login');
      const denied = await agent.post('/login').type('form').send({
        _csrf: extractCsrf(loginPage.text),
        username,
        password: 'Lifecycle@123',
      });
      expect(denied.status).toBe(302);
      expect(denied.headers.location).toBe('/login');
      expect(await users.findById(user.id)).toBeTruthy();

      await users.setActive(user.id, true, admin.id);
      expect((await users.findById(user.id)).is_active).toBe(true);
    } finally {
      if (user) await db('users').where({ id: user.id }).del();
    }
  });

  test('an administrator cannot deactivate or demote their own account', async () => {
    const admin = await db('users').where({ username: 'admin' }).first();
    await expect(users.setActive(admin.id, false, admin.id))
      .rejects.toThrow('You cannot deactivate your own account');
    await expect(users.update(admin.id, {
      name: admin.name,
      username: admin.username,
      email: admin.email,
      role: 'viewer',
    }, admin.id)).rejects.toThrow('You cannot remove your own administrator role');
    const unchanged = await users.findById(admin.id);
    expect(unchanged.is_active).toBe(true);
    expect(unchanged.role).toBe('admin');
  });
});
