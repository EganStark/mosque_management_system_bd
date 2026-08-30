function configuration() {
  return {
    enabled: process.env.SMS_GATEWAY_ENABLED === 'true',
    url: process.env.SMS_GATEWAY_URL || '',
    token: process.env.SMS_GATEWAY_TOKEN || '',
    sender: process.env.SMS_SENDER_ID || '',
  };
}

function status() {
  const config = configuration();
  return { enabled: config.enabled && Boolean(config.url && config.token), sender: config.sender || null, unitCost: Number(process.env.SMS_UNIT_COST || 0), currency: process.env.SMS_COST_CURRENCY || 'BDT' };
}

async function send({ to, message }) {
  const config = configuration();
  if (!config.enabled || !config.url || !config.token) throw new Error('SMS gateway is not configured');
  const response = await fetch(config.url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${config.token}` },
    body: JSON.stringify({ to, message, sender_id: config.sender || undefined }),
    signal: AbortSignal.timeout(15000),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`SMS gateway returned ${response.status}: ${text.slice(0, 300)}`);
  let payload;
  try { payload = JSON.parse(text); } catch (_) { payload = { response: text }; }
  return { id: payload.message_id || payload.id || null, response: payload };
}

module.exports = { status, send };
