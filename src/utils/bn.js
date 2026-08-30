// Bengali localization helpers: numerals, money, dates, month names.

const EN_TO_BN = { '0': '০', '1': '১', '2': '২', '3': '৩', '4': '৪', '5': '৫', '6': '৬', '7': '৭', '8': '৮', '9': '৯' };

const BN_MONTHS = [
  'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
  'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর',
];

const BN_MONTHS_SHORT = ['জানু', 'ফেব্রু', 'মার্চ', 'এপ্রি', 'মে', 'জুন', 'জুলা', 'আগ', 'সেপ্টে', 'অক্টো', 'নভে', 'ডিসে'];

/** Convert any Arabic numerals inside a string to Bengali numerals. */
function toBnDigits(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[0-9]/g, (d) => EN_TO_BN[d]);
}

/** Format a number with thousands separators and 2 decimals, then Bengali digits. */
function money(amount, { bn = true } = {}) {
  const n = Number(amount || 0);
  const formatted = n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return bn ? toBnDigits(formatted) : formatted;
}

/** Format a plain integer/number with Bengali digits (no decimals). */
function num(value, { bn = true } = {}) {
  const n = Number(value || 0);
  const formatted = n.toLocaleString('en-US');
  return bn ? toBnDigits(formatted) : formatted;
}

/** Format a Date / date string as DD-MM-YYYY (Bengali digits by default). */
function date(value, { bn = true } = {}) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const out = `${dd}-${mm}-${yyyy}`;
  return bn ? toBnDigits(out) : out;
}

/** "মে ২০২৬" style label for a Date. */
function monthLabel(value, { bn = true } = {}) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const label = `${BN_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  return bn ? toBnDigits(label) : label;
}

module.exports = { toBnDigits, money, num, date, monthLabel, BN_MONTHS, BN_MONTHS_SHORT };
