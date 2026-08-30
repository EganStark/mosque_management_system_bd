/* global $, flatpickr */
(function () {
  'use strict';

  const BN_DT_LANG = {
    search: 'অনুসন্ধান:',
    lengthMenu: '_MENU_ টি দেখান',
    info: '_TOTAL_ টির মধ্যে _START_–_END_ দেখানো হচ্ছে',
    infoEmpty: 'কোন তথ্য নেই',
    infoFiltered: '(_MAX_ টি থেকে ফিল্টার করা)',
    zeroRecords: 'কিছু পাওয়া যায়নি',
    paginate: { first: 'প্রথম', last: 'শেষ', next: 'পরবর্তী', previous: 'পূর্ববর্তী' },
  };

  const EN_DT_LANG = {
    search: 'Search:', lengthMenu: 'Show _MENU_', info: 'Showing _START_–_END_ of _TOTAL_',
    infoEmpty: 'No records available', infoFiltered: '(filtered from _MAX_)',
    zeroRecords: 'No matching records found',
    paginate: { first: 'First', last: 'Last', next: 'Next', previous: 'Previous' },
  };

  const ADMIN_LANG_KEY = 'brjm-admin-lang';
  const ADMIN_TRANSLATIONS = {
    'মসজিদ ব্যবস্থাপনা': 'Mosque management', 'ওভারভিউ': 'Overview',
    'ড্যাশবোর্ড': 'Dashboard', 'ড্যাশবোর্ড ওভারভিউ': 'Dashboard overview',
    'দৈনন্দিন কাজ': 'Daily operations', 'সদস্য ব্যবস্থাপনা': 'Member management',
    'মাসিক চাঁদা': 'Monthly dues', 'যোগাযোগ কেন্দ্র': 'Communication center', 'পাবলিক ইনবক্স': 'Public inbox', 'প্রোগ্রাম ও শিক্ষা': 'Programs & education', 'সুবিধা ও বুকিং': 'Facilities & bookings', 'কল্যাণ ও সহায়তা': 'Welfare & assistance', 'কমিটি ও স্টাফ': 'Committee & staff', 'স্টাফ ডিউটি ও বেতন': 'Staff duty & payroll',
    'মরহুম সদস্য': 'Deceased members', 'সম্পদ রেজিস্টার': 'Asset register', 'রক্ষণাবেক্ষণ': 'Maintenance', 'ক্রয় ও সরবরাহ': 'Procurement', 'স্টোর ও মজুত': 'Store & inventory', 'সভা ও সিদ্ধান্ত': 'Meetings & decisions', 'নথি ও আর্কাইভ': 'Documents & archive',
    'আদায়': 'Collections', 'খরচ': 'Expenses', 'ক্যাশ ও ব্যাংক': 'Cash & bank',
    'রিপোর্ট': 'Reports', 'রিপোর্ট কেন্দ্র': 'Report center', 'সদস্য লেজার': 'Member ledger',
    'মাসিক বকেয়া': 'Monthly arrears', 'কমিউনিটি বিশ্লেষণ': 'Community analytics', 'খাতভিত্তিক সারাংশ': 'Category summary', 'পরিচালনাগত রিপোর্ট': 'Operational reports', 'আর্থিক জবাবদিহি': 'Financial accountability', 'ঋণ ও কিস্তি': 'Loans & repayments', 'দান অঙ্গীকার ও বকেয়া': 'Donation pledges & dues',
    'আদায় রিপোর্ট': 'Collection report', 'খরচ রিপোর্ট': 'Expense report',
    'আয়–ব্যয় সারাংশ': 'Income & expense', 'ব্যাংক স্টেটমেন্ট': 'Bank statement',
    'পরিচালনা': 'Administration', 'ওয়েবসাইট কনটেন্ট': 'Website content',
    'কনটেন্ট ওভারভিউ': 'Content overview', 'নামাজের সময়': 'Prayer times',
    'অনুষ্ঠান': 'Events', 'ঘোষণা': 'Announcements', 'স্টাফ': 'Staff',
    'গ্যালারি': 'Gallery', 'জানাজা নোটিশ': 'Janaza notices', 'সাধারণ প্রশ্ন': 'FAQ',
    'সেটআপ ও প্রশাসন': 'Setup & administration', 'প্রতিষ্ঠানের তথ্য': 'Organization settings',
    'ব্যবহারকারী': 'Users', 'নিরাপত্তা ও অডিট': 'Security & audit',
    'ব্যাকআপ ও পুনরুদ্ধার': 'Backup & restore', 'রশিদ বইয়ের ধরন': 'Receipt book types',
    'রশিদ বই নম্বর': 'Receipt book numbers', 'পেশা': 'Occupations',
    'ঠিকানা ডেটা': 'Address data', 'বিভাগ': 'Division', 'জেলা': 'District',
    'থানা': 'Thana', 'পোস্ট অফিস': 'Post office', 'গ্রাম': 'Village', 'এলাকা': 'Area',
    'ওয়েবসাইট দেখুন': 'View website', 'লগআউট': 'Logout', 'এডমিন': 'Admin',
    'দর্শক': 'Viewer', 'সংরক্ষণ করুন': 'Save', 'সংরক্ষণ': 'Save', 'বাতিল': 'Cancel',
    'সম্পাদনা': 'Edit', 'মুছুন': 'Delete', 'বিস্তারিত': 'Details', 'ফিরে যান': 'Go back',
    'যোগ করুন': 'Add', 'নতুন যোগ করুন': 'Add new', 'অনুসন্ধান': 'Search',
    'সক্রিয়': 'Active', 'নিষ্ক্রিয়': 'Inactive', 'অবস্থা': 'Status', 'নাম': 'Name',
    'মোবাইল': 'Mobile', 'ঠিকানা': 'Address', 'তারিখ': 'Date', 'পরিমাণ': 'Amount',
    'বিবরণ': 'Description', 'কার্যক্রম': 'Actions', 'চলতি মাস': 'Current month',
    'সর্বমোট নিবন্ধিত সদস্য': 'Total registered members',
    'চলতি মাসের মোট আদায়': 'Total collection this month',
    'চলতি মাসের মোট খরচ': 'Total expense this month',
    'চলতি মাসের ব্যালেন্স': 'Balance this month', 'অবশিষ্ট': 'Balance',
    'বর্তমান তহবিল অবস্থান': 'Current fund position', 'মসজিদের সম্পদ': 'Mosque assets',
    'চলতি মাসের সদস্য চাঁদা': 'Member dues this month',
    'মাসিক চাঁদা পরিচালনা': 'Manage monthly dues', 'নগদ হিসাবে অবশিষ্ট': 'Cash balance',
    'নগদ আদায় থেকে নগদ খরচ বাদ': 'Cash collections less cash expenses',
    'ব্যাংকে রেকর্ডকৃত': 'Recorded in bank',
    'ব্যাংক-পদ্ধতির আয় ও ব্যয়ের নিট হিসাব': 'Net bank income and expenses',
    'মোবাইল ব্যাংকিং': 'Mobile banking',
    'মোবাইল ব্যাংকিং আয় ও ব্যয়ের নিট হিসাব': 'Net mobile banking income and expenses',
    'আদায় বনাম খরচ': 'Collections vs expenses',
    'গত ৬ মাসের আর্থিক উপাত্তের তুলনাচিত্র': 'Financial comparison for the last 6 months',
    'স্বয়ংক্রিয় আপডেট': 'Auto updated', 'মোট আদায় (Collections)': 'Total collections',
    'মোট খরচ (Expenses)': 'Total expenses', 'সর্বমোট আর্থিক হিসাব': 'Overall finances',
    'সর্বমোট আদায়কৃত ফান্ড': 'Total funds collected', 'সর্বমোট মসজিদ খরচ': 'Total mosque expenses',
    'বর্তমানে নেট অবশিষ্ট': 'Current net balance', 'সদস্য ডেমোগ্রাফিক': 'Member demographics',
    'সক্রিয় সদস্য (Active)': 'Active members', 'পুরুষ সদস্য (Male)': 'Male members',
    'মহিলা সদস্য (Female)': 'Female members', 'দ্রুত অ্যাকশন': 'Quick actions'
  };
  const originalText = new WeakMap();

  function getAdminLanguage() {
    return localStorage.getItem(ADMIN_LANG_KEY) === 'en' ? 'en' : 'bn';
  }

  function translateTextNodes(language) {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function (node) {
      if (node.parentElement && node.parentElement.closest('script, style, textarea')) return;
      if (!originalText.has(node)) originalText.set(node, node.nodeValue);
      const source = originalText.get(node);
      const trimmed = source.trim();
      if (!trimmed) return;
      if (ADMIN_TRANSLATIONS[trimmed]) {
        node.nodeValue = source.replace(trimmed, language === 'en' ? ADMIN_TRANSLATIONS[trimmed] : trimmed);
      } else if (language === 'en') {
        node.nodeValue = source.replace(/[০-৯]/g, function (digit) { return '০১২৩৪৫৬৭৮৯'.indexOf(digit); });
      }
    });
  }

  function applyAdminLanguage(language, persist) {
    document.documentElement.lang = language;
    document.documentElement.dataset.adminLanguage = language;
    document.querySelectorAll('[data-bn][data-en]').forEach(function (element) {
      element.textContent = language === 'en' ? element.dataset.en : element.dataset.bn;
    });
    document.querySelectorAll('[data-placeholder-bn][data-placeholder-en]').forEach(function (element) {
      element.placeholder = language === 'en' ? element.dataset.placeholderEn : element.dataset.placeholderBn;
    });
    document.querySelectorAll('input[placeholder], textarea[placeholder]').forEach(function (element) {
      if (!element.dataset.originalPlaceholder) element.dataset.originalPlaceholder = element.placeholder;
      const source = element.dataset.originalPlaceholder;
      element.placeholder = language === 'en' && ADMIN_TRANSLATIONS[source] ? ADMIN_TRANSLATIONS[source] : source;
    });
    translateTextNodes(language);
    const dateHost = document.querySelector('[data-admin-date]');
    const dateLabel = dateHost && dateHost.querySelector('.admin-date-label');
    if (dateLabel && language === 'en') {
      dateLabel.textContent = new Intl.DateTimeFormat('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric'
      }).format(new Date(dateHost.dataset.adminDate));
    }
    const label = document.querySelector('#adminLanguageToggle .language-label');
    if (label) label.textContent = language === 'bn' ? 'EN' : 'বাংলা';
    if (persist !== false) localStorage.setItem(ADMIN_LANG_KEY, language);
  }

  $(function () {
    applyAdminLanguage(getAdminLanguage(), false);
    $('#adminLanguageToggle').on('click', function () {
      applyAdminLanguage(getAdminLanguage() === 'bn' ? 'en' : 'bn', true);
      window.location.reload();
    });
    updateThemeIcon();
    $('#themeToggle').on('click', function () {
      const isDark = document.documentElement.classList.toggle('dark');
      document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
      localStorage.setItem('brjm-admin-theme', isDark ? 'dark' : 'light');
      updateThemeIcon();
    });

    // Sidebar toggle
    $('#sidebarToggle').on('click', function () {
      const $shell = $('.app-shell');
      if (window.matchMedia('(max-width: 1024px)').matches) {
        $shell.toggleClass('active-mobile');
      } else {
        $shell.toggleClass('collapsed');
      }
    });

    $(document).on('click', function (event) {
      if (!window.matchMedia('(max-width: 1024px)').matches) return;
      if (!$(event.target).closest('#sidebar, #sidebarToggle').length) {
        $('.app-shell').removeClass('active-mobile');
      }
    });

    // DataTables with export buttons
    $('table.datatable').each(function () {
      const $t = $(this);
      const withButtons = $t.data('buttons') !== false;
      $t.DataTable({
        language: getAdminLanguage() === 'en' ? EN_DT_LANG : BN_DT_LANG,
        pageLength: 25,
        lengthMenu: [[25, 50, 100, 500, -1], [25, 50, 100, 500, 'সব']],
        order: [],
        dom: withButtons ? "<'row'<'col-sm-6'l><'col-sm-6'f>>Brtip" : 'lfrtip',
        buttons: withButtons
          ? [
              { extend: 'copy', text: 'কপি', className: 'btn btn-sm btn-outline-secondary' },
              { extend: 'csv', text: 'CSV', className: 'btn btn-sm btn-outline-secondary' },
              { extend: 'excel', text: 'Excel', className: 'btn btn-sm btn-outline-success' },
              { extend: 'pdf', text: 'PDF', className: 'btn btn-sm btn-outline-danger' },
              { extend: 'print', text: 'প্রিন্ট', className: 'btn btn-sm btn-outline-primary' },
            ]
          : [],
      });
    });

    // Select2
    $('.select2').each(function () {
      $(this).select2({ theme: 'bootstrap-5', width: '100%', dropdownParent: $(this).parent() });
    });

    // Flatpickr date inputs
    if (window.flatpickr) {
      flatpickr('.datepicker', { dateFormat: 'Y-m-d', allowInput: true });
    }

    // Cascading address selects on the member form
    initCascade();

    // Repeatable child rows
    initChildRows();
  });

  function updateThemeIcon() {
    const icon = document.querySelector('#themeToggle .theme-icon');
    if (icon) icon.textContent = document.documentElement.classList.contains('dark') ? 'light_mode' : 'dark_mode';
  }

  function initCascade() {
    const chain = ['division', 'district', 'thana', 'post_office', 'village', 'area'];
    chain.forEach(function (level, idx) {
      const $sel = $('#addr_' + level);
      if (!$sel.length) return;
      $sel.on('change', function () {
        const childLevel = chain[idx + 1];
        if (!childLevel) return;
        const $child = $('#addr_' + childLevel);
        const parentId = $(this).val();
        // Clear all descendants
        for (let j = idx + 1; j < chain.length; j++) {
          $('#addr_' + chain[j]).html('<option value="">নির্বাচন করুন</option>');
        }
        if (!parentId) return;
        fetch('/locations/api/' + childLevel + '?parent_id=' + encodeURIComponent(parentId))
          .then((r) => r.json())
          .then((rows) => {
            let opts = '<option value="">নির্বাচন করুন</option>';
            rows.forEach((row) => {
              opts += '<option value="' + row.id + '">' + row.name + '</option>';
            });
            $child.html(opts);
            if (childLevel === 'post_office') {
              $child.off('change.pc').on('change.pc', function () {
                const sel = rows.find((x) => String(x.id) === String($(this).val()));
                if (sel && sel.post_code) $('#post_code').val(sel.post_code);
              });
            }
          });
      });
    });
  }

  function initChildRows() {
    $('.add-child').on('click', function () {
      const type = $(this).data('type');
      const tpl = document.getElementById('tpl-' + type);
      if (!tpl) return;
      const node = tpl.content.cloneNode(true);
      document.getElementById('children-' + type).appendChild(node);
      if (window.flatpickr) flatpickr('#children-' + type + ' .datepicker', { dateFormat: 'Y-m-d', allowInput: true });
    });
    $(document).on('click', '.remove-child', function () {
      $(this).closest('.child-row').remove();
    });
  }

  document.addEventListener('keydown', function (event) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      const input = document.getElementById('globalSearchInput');
      if (input) { event.preventDefault(); input.focus(); input.select(); }
    }
  });

  // Bulk selection controls used by management tables.
  document.querySelectorAll('[data-bulk-form]').forEach(function (form) {
    const items = Array.from(document.querySelectorAll('[data-bulk-item][form="' + form.id + '"]'));
    const selectAll = document.querySelector('[data-bulk-select-all]');
    const count = form.querySelector('[data-bulk-count]');
    const submit = form.querySelector('[data-bulk-submit]');
    function refreshBulkSelection() {
      const selected = items.filter((item) => item.checked).length;
      if (count) count.textContent = String(selected);
      if (submit) submit.disabled = selected === 0;
      if (selectAll) { selectAll.checked = items.length > 0 && selected === items.length; selectAll.indeterminate = selected > 0 && selected < items.length; }
    }
    if (selectAll) selectAll.addEventListener('change', function () { items.forEach((item) => { item.checked = selectAll.checked; }); refreshBulkSelection(); });
    items.forEach((item) => item.addEventListener('change', refreshBulkSelection));
    form.addEventListener('submit', function (event) { if (!items.some((item) => item.checked)) event.preventDefault(); });
    refreshBulkSelection();
  });

  // Confirm-delete forms
  $(document).on('submit', 'form.confirm-delete', function (e) {
    if (!confirm('আপনি কি নিশ্চিত? এটি মুছে ফেলা হবে।')) e.preventDefault();
  });
  $(document).on('submit', 'form[data-confirm]', function (e) {
    if (!confirm($(this).data('confirm') || 'আপনি কি নিশ্চিত?')) e.preventDefault();
  });

  // Generic edit modal: reads data-action + data-fields (JSON) and fills #editForm.
  $(document).on('click', '.edit-row', function () {
    const action = $(this).data('action');
    const fields = $(this).data('fields') || {};
    const $form = $('#editForm');
    $form.attr('action', action);
    Object.keys(fields).forEach(function (key) {
      const $input = $form.find('[name="' + key + '"]');
      if (!$input.length) return;
      if ($input.is(':checkbox')) $input.prop('checked', !!fields[key] && fields[key] !== 'false');
      else $input.val(fields[key]);
    });
    const modalEl = document.getElementById('editModal');
    if (modalEl && window.bootstrap) new bootstrap.Modal(modalEl).show();
  });
})();
