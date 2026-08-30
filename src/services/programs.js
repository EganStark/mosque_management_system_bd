const db = require('../config/db');

function nullable(data, keys) { const out = { ...data }; keys.forEach((key) => { if (out[key] === '' || out[key] === undefined) out[key] = null; }); return out; }

async function list() {
  return db('mosque_programs as p').leftJoin('program_enrollments as e', function () { this.on('e.program_id', '=', 'p.id').andOnVal('e.status', '=', 'active'); })
    .select('p.*').count('e.id as participant_count').groupBy('p.id').orderByRaw("CASE WHEN p.status='active' THEN 0 ELSE 1 END").orderBy('p.id', 'desc');
}
async function summary() {
  const row = await db('mosque_programs as p').leftJoin('program_enrollments as e', 'e.program_id', 'p.id').first(
    db.raw("COUNT(DISTINCT p.id) FILTER (WHERE p.status='active')::int as active_programs"),
    db.raw("COUNT(DISTINCT e.id) FILTER (WHERE e.status='active')::int as active_participants"));
  const attendance = await db('program_attendance').where({ attendance_date: db.raw('CURRENT_DATE') }).count('* as total').count('* as present').first();
  return { activePrograms: Number(row.active_programs || 0), activeParticipants: Number(row.active_participants || 0), todayRecords: Number(attendance.total || 0) };
}
async function find(id) {
  const program = await db('mosque_programs').where({ id }).first();
  if (!program) return null;
  program.enrollments = await db('program_enrollments as e').leftJoin('members as m', 'e.member_id', 'm.id').select('e.*', 'm.id_no as member_id_no').where('e.program_id', id).orderBy('e.participant_name');
  return program;
}
async function create(data, userId) {
  const payload = nullable({ name: data.name, category: data.category, description: data.description || null,
    instructor_name: data.instructor_name || null, venue: data.venue || null, schedule_text: data.schedule_text || null,
    start_date: data.start_date, end_date: data.end_date, capacity: data.capacity || null,
    status: ['active', 'planned', 'completed', 'cancelled'].includes(data.status) ? data.status : 'active', created_by: userId }, ['start_date', 'end_date', 'capacity']);
  return (await db('mosque_programs').insert(payload).returning('*'))[0];
}
async function enroll(programId, data) {
  const member = data.member_id ? await db('members').where({ id: data.member_id }).first() : null;
  const program = await db('mosque_programs').where({ id: programId }).first();
  if (!program) throw new Error('Program not found');
  if (program.capacity) { const [{ count }] = await db('program_enrollments').where({ program_id: programId, status: 'active' }).count('* as count'); if (Number(count) >= Number(program.capacity)) throw new Error('Program capacity is full'); }
  const payload = nullable({ program_id: programId, member_id: member ? member.id : null, participant_name: member ? member.name : data.participant_name, phone: member ? member.phone : data.phone, guardian_name: data.guardian_name, guardian_phone: data.guardian_phone, notes: data.notes }, ['member_id']);
  return (await db('program_enrollments').insert(payload).returning('*'))[0];
}
async function attendanceSheet(programId, date) {
  return db('program_enrollments as e').leftJoin('program_attendance as a', function () { this.on('a.enrollment_id', '=', 'e.id').andOn('a.attendance_date', '=', db.raw('?', [date])); })
    .select('e.id', 'e.participant_name', 'e.phone', 'a.status as attendance_status', 'a.remarks').where({ 'e.program_id': programId, 'e.status': 'active' }).orderBy('e.participant_name');
}
async function saveAttendance(programId, date, rows, userId) {
  return db.transaction(async (trx) => {
    const allowed = new Set((await trx('program_enrollments').where({ program_id: programId, status: 'active' }).whereIn('id', rows.map((row) => row.enrollment_id)).pluck('id')).map(Number));
    for (const row of rows.filter((item) => allowed.has(Number(item.enrollment_id)))) {
      await trx('program_attendance').insert({ program_id: programId, enrollment_id: row.enrollment_id, attendance_date: date, status: row.status, remarks: row.remarks || null, recorded_by: userId })
        .onConflict(['enrollment_id', 'attendance_date']).merge(['status', 'remarks', 'recorded_by']);
    }
  });
}

module.exports = { list, summary, find, create, enroll, attendanceSheet, saveAttendance };
