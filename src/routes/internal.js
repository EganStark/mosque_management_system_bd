const crypto = require('crypto');
const express = require('express');
const backups = require('../services/backups');

const router = express.Router();

function validBearerToken(headerValue, expected) {
  const supplied = String(headerValue || '').replace(/^Bearer\s+/i, '');
  if (!expected || expected.length < 32 || supplied.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
}

router.post('/backups/run', async (req, res) => {
  const expected = process.env.BACKUP_TRIGGER_SECRET;
  if (!expected || expected.length < 32) {
    return res.status(503).json({ error: 'Automated backup trigger is not configured' });
  }
  if (!validBearerToken(req.get('authorization'), expected)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const result = await backups.createAutomatedBackup({
      retentionDays: process.env.BACKUP_RETENTION_DAYS || 30,
    });
    return res.status(201).json({
      status: 'created',
      target: result.target,
      createdAt: result.createdAt,
      checksum: result.checksum,
      expiredBackupsRemoved: result.removed.length,
    });
  } catch (error) {
    console.error(`Automated backup trigger failed: ${error.message}`);
    return res.status(500).json({ error: 'Database backup failed' });
  }
});

module.exports = router;
