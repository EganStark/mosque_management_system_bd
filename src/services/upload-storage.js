const fs = require('fs');
const path = require('path');
const db = require('../config/db');
const { UPLOAD_DIR, removeUploadedFile } = require('../middleware/upload');

const REFERENCE_COLUMNS = [
  ['members', ['photo', 'spouse_photo', 'father_photo', 'mother_photo']],
  ['member_children', ['photo']],
  ['company_settings', ['logo']],
  ['staff_members', ['photo']],
  ['gallery_images', ['image_path']],
];

function isSafeFilename(value) {
  const filename = String(value || '');
  return Boolean(filename && filename === path.basename(filename) && filename !== '.gitkeep');
}

function filenameFromPublicPath(value) {
  const normalized = String(value || '').replace(/\\/g, '/');
  if (!normalized.startsWith('/uploads/')) return null;
  const filename = normalized.slice('/uploads/'.length);
  return isSafeFilename(filename) ? filename : null;
}

async function referencedFilenames() {
  const referenced = new Set();
  for (const [table, columns] of REFERENCE_COLUMNS) {
    const rows = await db(table).select(columns);
    rows.forEach((row) => columns.forEach((column) => {
      const filename = filenameFromPublicPath(row[column]);
      if (filename) referenced.add(filename);
    }));
  }
  return referenced;
}

async function report() {
  const referenced = await referencedFilenames();
  const entries = await fs.promises.readdir(UPLOAD_DIR, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (!entry.isFile() || !isSafeFilename(entry.name)) continue;
    const stat = await fs.promises.stat(path.join(UPLOAD_DIR, entry.name));
    files.push({
      name: entry.name,
      size: stat.size,
      modifiedAt: stat.mtime,
      referenced: referenced.has(entry.name),
    });
  }
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  const orphaned = files
    .filter((file) => !file.referenced && file.modifiedAt.getTime() < oneHourAgo)
    .sort((a, b) => b.modifiedAt - a.modifiedAt);
  return {
    files: files.length,
    totalBytes: files.reduce((sum, file) => sum + file.size, 0),
    referenced: files.filter((file) => file.referenced).length,
    orphaned,
    orphanBytes: orphaned.reduce((sum, file) => sum + file.size, 0),
  };
}

async function cleanup(selected) {
  const requested = [...new Set((Array.isArray(selected) ? selected : [selected]).filter(isSafeFilename))].slice(0, 100);
  if (!requested.length) throw new Error('Select at least one orphaned upload');
  const current = await report();
  const allowed = new Set(current.orphaned.map((file) => file.name));
  let removed = 0;
  let bytes = 0;
  for (const filename of requested) {
    if (!allowed.has(filename)) continue;
    const file = current.orphaned.find((item) => item.name === filename);
    if (await removeUploadedFile(`/uploads/${filename}`)) {
      removed += 1;
      bytes += file ? file.size : 0;
    }
  }
  return { removed, bytes };
}

module.exports = { report, cleanup, isSafeFilename, filenameFromPublicPath };
