async function assertIndependentApproval(trx, requestedBy, actorId, action = 'request') {
  if (!requestedBy || Number(requestedBy) !== Number(actorId)) return;
  const row = await trx('users').where({ role: 'admin', is_active: true }).count('* as count').first();
  if (Number(row.count || 0) > 1) throw new Error(`Another administrator must approve this ${action}`);
}
module.exports = { assertIndependentApproval };
