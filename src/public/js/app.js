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

  $(function () {
    // Sidebar toggle
    $('#sidebarToggle').on('click', function () {
      $('.app-shell').toggleClass('collapsed');
    });

    // DataTables with export buttons
    $('table.datatable').each(function () {
      const $t = $(this);
      const withButtons = $t.data('buttons') !== false;
      $t.DataTable({
        language: BN_DT_LANG,
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

  // Confirm-delete forms
  $(document).on('submit', 'form.confirm-delete', function (e) {
    if (!confirm('আপনি কি নিশ্চিত? এটি মুছে ফেলা হবে।')) e.preventDefault();
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
