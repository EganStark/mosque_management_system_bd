function isoDate(offsetDays = 0) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

async function upsertOne(knex, table, where, values) {
  const existing = await knex(table).where(where).first();
  if (existing) {
    const columns = await knex(table).columnInfo();
    const update = { ...values };
    if (columns.updated_at) update.updated_at = knex.fn.now();
    if (Object.keys(update).length) await knex(table).where({ id: existing.id }).update(update);
    return knex(table).where({ id: existing.id }).first();
  }
  return (await knex(table).insert({ ...where, ...values }).returning('*'))[0];
}

exports.seed = async (knex) => {
  if (String(process.env.DEMO_DATA_ENABLED || '').toLowerCase() !== 'true') return;

  const admin = await knex('users').where({ role: 'admin', is_active: true }).orderBy('id').first();
  if (!admin) throw new Error('A private administrator must exist before seeding demonstration data');

  await knex.transaction(async (trx) => {
    const company = await trx('company_settings').orderBy('id').first();
    const companyValues = {
      company_name: 'Noor Community Mosque — Demo',
      company_address: 'Community Avenue, Dhaka — fictional portfolio address',
      company_phone: '+880 0000-000000',
      company_email: 'demo@example.invalid',
      updated_at: trx.fn.now(),
    };
    if (company) await trx('company_settings').where({ id: company.id }).update(companyValues);
    else await trx('company_settings').insert(companyValues);

    const memberRows = [
      { id_no: 'DEMO-M-001', name: 'আব্দুল্লাহ রহমান (Demo)', gender: 'male', phone: 'DEMO-01700000001', occupation_section: 'Teacher', address_text: 'Demo Block A, Dhaka', birth_date: '1985-03-12', monthly_payment: true, monthly_payment_amount: 1000 },
      { id_no: 'DEMO-M-002', name: 'মারইয়াম আক্তার (Demo)', gender: 'female', phone: 'DEMO-01700000002', occupation_section: 'Physician', address_text: 'Demo Block B, Dhaka', birth_date: '1990-08-22', monthly_payment: true, monthly_payment_amount: 1500 },
      { id_no: 'DEMO-M-003', name: 'ইউসুফ করিম (Demo)', gender: 'male', phone: 'DEMO-01700000003', occupation_section: 'Business', address_text: 'Demo Block C, Dhaka', birth_date: '1978-11-05', monthly_payment: true, monthly_payment_amount: 2000 },
      { id_no: 'DEMO-M-004', name: 'সুমাইয়া নূর (Demo)', gender: 'female', phone: 'DEMO-01700000004', occupation_section: 'Student', address_text: 'Demo Block D, Dhaka', birth_date: '2002-06-18', monthly_payment: false, monthly_payment_amount: 0 },
      { id_no: 'DEMO-M-005', name: 'ইব্রাহিম হাসান (Demo)', gender: 'male', phone: 'DEMO-01700000005', occupation_section: 'Engineer', address_text: 'Demo Block E, Dhaka', birth_date: '1988-01-27', monthly_payment: true, monthly_payment_amount: 1200 },
      { id_no: 'DEMO-M-006', name: 'খাদিজা সুলতানা (Demo)', gender: 'female', phone: 'DEMO-01700000006', occupation_section: 'Homemaker', address_text: 'Demo Block F, Dhaka', birth_date: '1983-09-09', monthly_payment: true, monthly_payment_amount: 800 },
    ];
    const members = [];
    for (const member of memberRows) {
      members.push(await upsertOne(trx, 'members', { id_no: member.id_no }, { ...member, status: 'active' }));
    }

    const categories = [];
    for (const item of [
      { code: 'DEMO-GENERAL', name: 'সাধারণ দান — Demo' },
      { code: 'DEMO-ZAKAT', name: 'যাকাত তহবিল — Demo' },
      { code: 'DEMO-EDU', name: 'শিক্ষা কার্যক্রম — Demo' },
    ]) categories.push(await upsertOne(trx, 'collection_categories', { code: item.code }, { name: item.name, is_active: true }));

    const receipts = [
      { receipt_no: 'DEMO-RCP-001', member_id: members[0].id, payer_name: members[0].name, collection_category_id: categories[0].id, amount: 2500, purpose: 'Monthly mosque support — fictional', date: isoDate(-24) },
      { receipt_no: 'DEMO-RCP-002', member_id: members[1].id, payer_name: members[1].name, collection_category_id: categories[1].id, amount: 5000, purpose: 'Zakat fund — fictional', date: isoDate(-18) },
      { receipt_no: 'DEMO-RCP-003', member_id: members[2].id, payer_name: members[2].name, collection_category_id: categories[2].id, amount: 7500, purpose: 'Quran education program — fictional', date: isoDate(-12) },
      { receipt_no: 'DEMO-RCP-004', member_id: members[4].id, payer_name: members[4].name, collection_category_id: categories[0].id, amount: 3000, purpose: 'Friday collection — fictional', date: isoDate(-6) },
      { receipt_no: 'DEMO-RCP-005', member_id: null, payer_name: 'Anonymous Demo Donor', collection_category_id: categories[0].id, amount: 1000, purpose: 'Community support — fictional', date: isoDate(-2) },
    ];
    for (const receipt of receipts) await upsertOne(trx, 'collections', { receipt_no: receipt.receipt_no }, { ...receipt, payment_method: 'cash', status: 'posted', created_by: admin.id });

    const heads = [];
    for (const name of ['Utilities — Demo', 'Maintenance — Demo', 'Education — Demo', 'Community welfare — Demo']) {
      heads.push(await upsertOne(trx, 'expense_heads', { name }, {}));
    }
    const expenseRows = [
      { voucher_no: 'DEMO-VCH-001', expense_head_id: heads[0].id, purpose: 'Electricity and water — fictional', payee: 'Demo Utility Provider', amount: 3200, date: isoDate(-20) },
      { voucher_no: 'DEMO-VCH-002', expense_head_id: heads[1].id, purpose: 'Sound system maintenance — fictional', payee: 'Demo Technical Services', amount: 1800, date: isoDate(-14) },
      { voucher_no: 'DEMO-VCH-003', expense_head_id: heads[2].id, purpose: 'Student learning materials — fictional', payee: 'Demo Book Supplier', amount: 2400, date: isoDate(-8) },
    ];
    for (const expense of expenseRows) await upsertOne(trx, 'expenses', { voucher_no: expense.voucher_no }, { ...expense, payment_method: 'cash', status: 'posted', created_by: admin.id, approved_by: admin.id, approved_at: trx.fn.now() });

    await upsertOne(trx, 'banks', { name: 'Demo Islamic Bank' }, { account_number: 'DEMO-ACCOUNT-001', branch_name: 'Portfolio Branch', opening_balance: 25000, opening_balance_date: isoDate(-90), is_active: true });
    await upsertOne(trx, 'mobile_wallets', { name: 'Demo Donation Wallet' }, { provider: 'bkash', account_number: 'DEMO-WALLET-001', opening_balance: 5000, opening_balance_date: isoDate(-60), is_active: true });

    const published = { is_active: true, publication_status: 'published', published_at: trx.fn.now(), published_by: admin.id, review_status: 'approved', reviewed_at: trx.fn.now(), reviewed_by: admin.id };
    const eventRows = [
      { title_en: 'Weekly Quran Recitation Class', title_bn: 'সাপ্তাহিক কুরআন তিলাওয়াত ক্লাস', description_en: 'A guided recitation class for all skill levels. Fictional demo event.', description_bn: 'সকল স্তরের জন্য নির্দেশিত তিলাওয়াত ক্লাস। এটি একটি ডেমো ইভেন্ট।', category: 'education', event_date: isoDate(5), event_time: '18:30', end_time: '19:30', location: 'Education Hall', recurrence_type: 'weekly', recurrence_until: isoDate(68) },
      { title_en: 'Community Health Awareness Session', title_bn: 'কমিউনিটি স্বাস্থ্য সচেতনতা সভা', description_en: 'A fictional community wellbeing session for the portfolio demonstration.', description_bn: 'পোর্টফোলিও প্রদর্শনের জন্য একটি কাল্পনিক স্বাস্থ্য সচেতনতা সভা।', category: 'community', event_date: isoDate(12), event_time: '16:00', end_time: '17:30', location: 'Community Room', recurrence_type: 'none', recurrence_until: null },
      { title_en: 'Youth Volunteer Day', title_bn: 'যুব স্বেচ্ছাসেবক দিবস', description_en: 'Demo volunteering and mosque-care activities for young community members.', description_bn: 'তরুণদের জন্য ডেমো স্বেচ্ছাসেবা ও মসজিদ পরিচর্যা কার্যক্রম।', category: 'youth', event_date: isoDate(20), event_time: '09:00', end_time: '12:00', location: 'Mosque Courtyard', recurrence_type: 'monthly', recurrence_until: isoDate(110) },
    ];
    for (const event of eventRows) await upsertOne(trx, 'events', { title_en: event.title_en }, { ...event, ...published });

    const announcementRows = [
      { title_en: 'Welcome to the Mosque Management System Demo', title_bn: 'মসজিদ ম্যানেজমেন্ট সিস্টেম ডেমোতে স্বাগতম', content_en: 'Explore the public website and the read-only administration dashboard using fictional data.', content_bn: 'কাল্পনিক তথ্য ব্যবহার করে পাবলিক ওয়েবসাইট ও রিড-অনলি ড্যাশবোর্ড দেখুন।', category: 'general', publish_date: isoDate(-2) },
      { title_en: 'Friday Community Program', title_bn: 'শুক্রবারের কমিউনিটি কার্যক্রম', content_en: 'A fictional family learning session will follow Jumuah prayer.', content_bn: 'জুমার নামাজের পর একটি কাল্পনিক পারিবারিক শিক্ষা কার্যক্রম অনুষ্ঠিত হবে।', category: 'event', publish_date: isoDate(-1) },
    ];
    for (const item of announcementRows) await upsertOne(trx, 'announcements', { title_en: item.title_en }, { ...item, ...published });

    const staffRows = [
      { name_en: 'Imam Abdullah Faruq (Demo)', name_bn: 'ইমাম আব্দুল্লাহ ফারুক (ডেমো)', position_en: 'Imam and Khatib', position_bn: 'ইমাম ও খতিব', bio_en: 'Fictional profile for portfolio demonstration.', bio_bn: 'পোর্টফোলিও প্রদর্শনের জন্য কাল্পনিক প্রোফাইল।', staff_type: 'imam', sort_order: 1 },
      { name_en: 'Hafiz Salman Noor (Demo)', name_bn: 'হাফেজ সালমান নূর (ডেমো)', position_en: 'Quran Instructor', position_bn: 'কুরআন শিক্ষক', bio_en: 'Fictional education-team profile.', bio_bn: 'কাল্পনিক শিক্ষা দলের প্রোফাইল।', staff_type: 'teacher', sort_order: 2 },
    ];
    for (const item of staffRows) await upsertOne(trx, 'staff_members', { name_en: item.name_en }, { ...item, position_en: item.position_en, position_bn: item.position_bn, name_bn: item.name_bn, bio_en: item.bio_en, bio_bn: item.bio_bn, employment_status: 'active', show_on_website: true, ...published });

    const programRows = [
      { name: 'Weekend Quran Learning — Demo', category: 'education', description: 'Fictional weekend learning program for children and families.', instructor_name: 'Hafiz Salman Noor (Demo)', venue: 'Education Hall', schedule_text: 'Friday and Saturday, 09:00–11:00', start_date: isoDate(-30), end_date: isoDate(120), capacity: 30 },
      { name: 'Youth Leadership Circle — Demo', category: 'youth', description: 'Fictional monthly youth development program.', instructor_name: 'Community Volunteer Team', venue: 'Community Room', schedule_text: 'Second Friday of each month', start_date: isoDate(-15), end_date: isoDate(180), capacity: 25 },
    ];
    const programs = [];
    for (const item of programRows) programs.push(await upsertOne(trx, 'mosque_programs', { name: item.name }, { ...item, status: 'active', created_by: admin.id }));
    for (let index = 0; index < 4; index += 1) {
      await upsertOne(trx, 'program_enrollments', { program_id: programs[0].id, member_id: members[index].id }, { participant_name: members[index].name, phone: members[index].phone, status: 'active', notes: 'Fictional demo enrollment' });
    }

    const assetCategory = await upsertOne(trx, 'asset_categories', { name: 'Mosque Equipment — Demo' }, { is_active: true });
    for (const item of [
      { asset_code: 'DEMO-AST-001', name: 'Digital Sound Mixer — Demo', quantity: 1, unit: 'unit', purchase_price: 45000, condition: 'good', location: 'Audio Control Room' },
      { asset_code: 'DEMO-AST-002', name: 'Prayer Hall Air Conditioner — Demo', quantity: 4, unit: 'unit', purchase_price: 72000, condition: 'good', location: 'Main Prayer Hall' },
    ]) await upsertOne(trx, 'assets', { asset_code: item.asset_code }, { ...item, category_id: assetCategory.id, purchase_date: isoDate(-180), supplier: 'Demo Equipment Supplier', status: 'active', created_by: admin.id, notes: 'Fictional portfolio asset' });

    const inventoryCategory = await upsertOne(trx, 'inventory_categories', { name: 'Community Supplies — Demo' }, { is_active: true });
    for (const item of [
      { item_code: 'DEMO-INV-001', name: 'Prayer Mat — Demo', unit: 'piece', stock_quantity: 45, average_unit_cost: 850, reorder_level: 10, reorder_quantity: 25, storage_location: 'Main Store' },
      { item_code: 'DEMO-INV-002', name: 'Quran Learning Book — Demo', unit: 'copy', stock_quantity: 22, average_unit_cost: 280, reorder_level: 15, reorder_quantity: 30, storage_location: 'Education Store' },
    ]) await upsertOne(trx, 'inventory_items', { item_code: item.item_code }, { ...item, category_id: inventoryCategory.id, description: 'Fictional portfolio inventory', is_active: true, created_by: admin.id });

    const beneficiary = await upsertOne(trx, 'welfare_beneficiaries', { identity_reference: 'DEMO-BEN-001' }, { name: 'Fictional Welfare Applicant', phone: 'DEMO-01700000999', address: 'Demo Community Address', household_size: 5, monthly_income: 12000, eligibility_status: 'verified', verification_notes: 'Fictional portfolio record', verified_by: admin.id, verified_at: trx.fn.now(), created_by: admin.id });
    await upsertOne(trx, 'welfare_applications', { application_no: 'DEMO-WEL-001' }, { beneficiary_id: beneficiary.id, assistance_type: 'education', fund_source: 'general', reason: 'Fictional education-support request for demonstration', requested_amount: 8000, approved_amount: 0, disbursed_amount: 0, urgency: 'normal', status: 'pending', created_by: admin.id });

    for (const item of [
      { task_no: 'DEMO-TASK-001', title: 'Review monthly utility usage — Demo', category: 'finance', priority: 'normal', status: 'in_progress', due_date: isoDate(7) },
      { task_no: 'DEMO-TASK-002', title: 'Prepare youth program materials — Demo', category: 'program', priority: 'high', status: 'open', due_date: isoDate(4) },
      { task_no: 'DEMO-TASK-003', title: 'Inspect prayer hall equipment — Demo', category: 'maintenance', priority: 'normal', status: 'open', due_date: isoDate(14) },
    ]) await upsertOne(trx, 'mosque_tasks', { task_no: item.task_no }, { ...item, description: 'Fictional portfolio task', start_date: isoDate(-2), assigned_user_id: admin.id, created_by: admin.id });
  });

  console.log('Seeded or refreshed the fictional portfolio demonstration dataset.');
};
