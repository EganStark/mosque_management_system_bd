const db = require('../config/db');
const security = require('./security');
function monthValue(value) { const text = String(value || ''); return /^\d{4}-(0[1-9]|1[0-2])$/.test(text) ? text : new Date().toISOString().slice(0, 7); }
function iso(date) { const pad = (number) => String(number).padStart(2, '0'); return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`; }
function dateValue(value) { if (value instanceof Date) return iso(value); return String(value || '').slice(0, 10); }
function add(rows, type, icon, color, href, titleKey, dateKey, timeKey, detail) { return rows.map((row) => ({ id: `${type}-${row.id}`, type, icon, color, title: row[titleKey], date: dateValue(row[dateKey]), time: timeKey && row[timeKey] ? String(row[timeKey]).slice(0, 5) : '', href: typeof href === 'function' ? href(row) : href, detail: typeof detail === 'function' ? detail(row) : detail || '' })); }
function recurringEventEntries(rows, start, end) {
  const rangeStart = new Date(`${start}T00:00:00`), rangeEnd = new Date(`${end}T00:00:00`); const entries = [];
  for (const row of rows) {
    const base = dateValue(row.event_date); const [year, month, day] = base.split('-').map(Number); let occurrence = new Date(year, month - 1, day); const recurrence = ['weekly', 'monthly'].includes(row.recurrence_type) ? row.recurrence_type : 'none'; const until = row.recurrence_until ? new Date(`${dateValue(row.recurrence_until)}T00:00:00`) : rangeEnd;
    let index = 0;
    while (index < 366 && occurrence < rangeEnd && occurrence <= until) {
      if (occurrence >= rangeStart) entries.push({ id: `event-${row.id}-${iso(occurrence)}`, type: 'event', icon: 'celebration', color: 'primary', title: row.title_bn, date: iso(occurrence), time: String(row.event_time).slice(0, 5), endTime: row.end_time ? String(row.end_time).slice(0, 5) : '', href: `/landing/events/${row.id}/edit`, detail: `${row.location}${row.end_time ? ` · ${String(row.event_time).slice(0, 5)}–${String(row.end_time).slice(0, 5)}` : ''}${recurrence !== 'none' ? ` · ${recurrence === 'weekly' ? 'সাপ্তাহিক' : 'মাসিক'}` : ''}` });
      if (recurrence === 'none') break;
      if (recurrence === 'weekly') occurrence = new Date(occurrence.getFullYear(), occurrence.getMonth(), occurrence.getDate() + 7);
      else { const targetMonth = occurrence.getMonth() + 1; const lastDay = new Date(occurrence.getFullYear(), targetMonth + 1, 0).getDate(); occurrence = new Date(occurrence.getFullYear(), targetMonth, Math.min(day, lastDay)); }
      index += 1;
    }
  }
  return entries;
}
function rosterEntries(rows, start, end) { const dayCodes = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']; const entries = []; const date = new Date(`${start}T00:00:00`); const stop = new Date(`${end}T00:00:00`); while (date < stop) { const key = iso(date); for (const row of rows.filter((item) => item.day_of_week === dayCodes[date.getDay()])) entries.push({ id: `duty-${row.id}-${key}`, type: 'duty', icon: 'badge', color: 'teal', title: row.duty_name, date: key, time: String(row.start_time).slice(0, 5), href: '/staff-operations', detail: `${row.name_bn}${row.location ? ` · ${row.location}` : ''} · ${String(row.start_time).slice(0, 5)}–${String(row.end_time).slice(0, 5)}` }); date.setDate(date.getDate() + 1); } return entries; }
async function get(value, role) {
  const month = monthValue(value); const start = `${month}-01`; const nextDate = new Date(`${start}T00:00:00`); nextDate.setMonth(nextDate.getMonth() + 1); const end = iso(nextDate);
  const [people, assets, deceased] = await Promise.all([security.allowed(role, 'people.manage'), security.allowed(role, 'assets.manage'), security.allowed(role, 'deceased.manage')]);
  const queries = [db('events').where({ is_active: true, publication_status: 'published' }).whereNull('deleted_at').where('event_date', '<', end).where((query) => query.whereNull('recurrence_until').orWhere('recurrence_until', '>=', start)).select('id', 'title_bn', 'event_date', 'event_time', 'end_time', 'location', 'recurrence_type', 'recurrence_until')];
  if (people) queries.push(
    db('committee_meetings').whereNot('status', 'cancelled').where('meeting_date', '>=', start).where('meeting_date', '<', end).select('id', 'meeting_no', 'title', 'meeting_date', 'start_time', 'venue'),
    db('facility_bookings').whereIn('status', ['pending', 'approved']).where('booking_date', '>=', start).where('booking_date', '<', end).select('id', 'booking_no', 'event_title', 'booking_date', 'start_time', 'status'),
    db('mosque_programs').whereNot('status', 'cancelled').where('start_date', '>=', start).where('start_date', '<', end).select('id', 'name', 'start_date', 'schedule_text', 'venue'),
    db('mosque_tasks').whereIn('status', ['open', 'in_progress', 'blocked']).where('due_date', '>=', start).where('due_date', '<', end).select('id', 'task_no', 'title', 'due_date', 'priority'),
    db('program_attendance as a').join('mosque_programs as p', 'a.program_id', 'p.id').where('a.attendance_date', '>=', start).where('a.attendance_date', '<', end).groupBy('a.program_id', 'p.name', 'a.attendance_date').select(db.raw("MIN(a.id) as id"), 'a.program_id', 'p.name', 'a.attendance_date').count('* as attendance_count'),
    db('staff_duty_rosters as r').join('staff_members as s', 'r.staff_id', 's.id').where('r.is_active', true).where('s.is_active', true).select('r.*', 's.name_bn')
  );
  if (assets) queries.push(db('maintenance_work_orders').whereNotIn('status', ['completed', 'cancelled']).where('scheduled_date', '>=', start).where('scheduled_date', '<', end).select('id', 'work_order_no', 'title', 'scheduled_date', 'priority'));
  if (deceased) queries.push(db('janaza_notices').where({ is_active: true }).where('janaza_date', '>=', start).where('janaza_date', '<', end).select('id', 'deceased_name_bn', 'janaza_date', 'janaza_time', 'location_bn'));
  const result = await Promise.all(queries); let index = 0;
  const entries = recurringEventEntries(result[index++], start, end);
  if (people) {
    entries.push(...add(result[index++], 'meeting', 'groups', 'info', (r) => `/governance-meetings/${r.id}`, 'title', 'meeting_date', 'start_time', (r) => `${r.meeting_no}${r.venue ? ` · ${r.venue}` : ''}`));
    entries.push(...add(result[index++], 'booking', 'event_available', 'success', (r) => `/bookings/${r.id}`, 'event_title', 'booking_date', 'start_time', (r) => `${r.booking_no} · ${r.status}`));
    entries.push(...add(result[index++], 'program', 'school', 'purple', (r) => `/programs/${r.id}`, 'name', 'start_date', null, (r) => r.schedule_text || r.venue || ''));
    entries.push(...add(result[index++], 'task', 'task_alt', 'warning', (r) => `/tasks/${r.id}`, 'title', 'due_date', null, (r) => `${r.task_no} · ${r.priority}`));
    entries.push(...add(result[index++], 'class', 'menu_book', 'indigo', (r) => `/programs/${r.program_id}`, 'name', 'attendance_date', null, (r) => `${Number(r.attendance_count)} attendance records`));
    entries.push(...rosterEntries(result[index++], start, end));
  }
  if (assets) entries.push(...add(result[index++], 'maintenance', 'build_circle', 'danger', (r) => `/maintenance/${r.id}`, 'title', 'scheduled_date', null, (r) => `${r.work_order_no} · ${r.priority}`));
  if (deceased) entries.push(...add(result[index++], 'janaza', 'deceased', 'slate', '/landing/janaza', 'deceased_name_bn', 'janaza_date', 'janaza_time', (r) => r.location_bn));
  entries.sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  const first = new Date(`${start}T00:00:00`); const gridStart = new Date(first); gridStart.setDate(1 - first.getDay());
  const days = Array.from({ length: 42 }, (_, offset) => { const date = new Date(gridStart); date.setDate(gridStart.getDate() + offset); const key = iso(date); return { key, number: date.getDate(), current: key.slice(0, 7) === month, today: key === iso(new Date()), entries: entries.filter((item) => item.date === key) }; });
  const previous = new Date(first); previous.setMonth(previous.getMonth() - 1); const next = new Date(first); next.setMonth(next.getMonth() + 1);
  return { month, days, entries, previous: iso(previous).slice(0, 7), next: iso(next).slice(0, 7), capabilities: { people, assets, deceased } };
}
module.exports = { get };
