const express = require('express');
const { body, validationResult } = require('express-validator');
const { requireAuth, canWrite, adminOnly } = require('../middleware/auth');
const { upload, uploadedPublicUrl } = require('../middleware/upload');
const members = require('../services/members');
const loc = require('../services/locations');

const router = express.Router();
router.use(requireAuth);

const photoFields = upload.fields([
  { name: 'photo', maxCount: 1 },
  { name: 'spouse_photo', maxCount: 1 },
  { name: 'father_photo', maxCount: 1 },
  { name: 'mother_photo', maxCount: 1 },
]);

function toArray(v) {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

// Build children array from parallel form arrays for a given type.
function childrenFromBody(body, type) {
  const names = toArray(body[`${type}_name`]);
  const sls = toArray(body[`${type}_sl`]);
  const births = toArray(body[`${type}_birth_date`]);
  const dies = toArray(body[`${type}_die_date`]);
  return names.map((name, i) => ({
    type, name, sl: sls[i] || null,
    birth_date: births[i] || null, die_date: dies[i] || null,
  }));
}

function collectChildren(body) {
  return [...childrenFromBody(body, 'son'), ...childrenFromBody(body, 'daughter')];
}

function fileName(files, field) {
  return files && files[field] && files[field][0] ? uploadedPublicUrl(files[field][0]) : undefined;
}

async function formData() {
  return {
    occupations: await loc.occupations.all(),
    divisions: await loc.all('division'),
    memberOptions: await members.options(),
  };
}

// --- List ---
router.get('/', async (req, res, next) => {
  try {
    const rows = await members.list();
    res.render('members/list', { title: 'সকল সদস্য', rows });
  } catch (err) {
    next(err);
  }
});

// --- New form ---
router.get('/new', canWrite, async (req, res, next) => {
  try {
    const fd = await formData();
    const nextId = await members.nextIdNo();
    res.render('members/form', {
      title: 'নতুন সদস্য', member: null, children: [], nextId, ...fd,
      districts: [], thanas: [], postOffices: [], villages: [], areas: [],
    });
  } catch (err) {
    next(err);
  }
});

// --- View ---
router.get('/:id', async (req, res, next) => {
  try {
    const member = await members.findFull(req.params.id);
    if (!member) return res.status(404).render('error', { title: 'পাওয়া যায়নি', status: 404, message: 'সদস্য পাওয়া যায়নি।' });
    const finance = await members.financialSummary(req.params.id);
    res.render('members/view', { title: member.name, member, finance });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/card', async (req, res, next) => {
  try {
    const member = await members.findFull(req.params.id);
    if (!member) return res.status(404).render('error', { title: 'পাওয়া যায়নি', status: 404, message: 'সদস্য পাওয়া যায়নি।' });
    res.render('members/card', { title: `${member.name} — সদস্য কার্ড`, member });
  } catch (err) { next(err); }
});

// --- Edit form ---
router.get('/:id/edit', canWrite, async (req, res, next) => {
  try {
    const member = await members.findFull(req.params.id);
    if (!member) return res.redirect('/members');
    const fd = await formData();
    res.render('members/form', {
      title: 'সদস্য সম্পাদনা', member, children: member.children || [], nextId: member.id_no,
      ...fd,
      districts: member.division_id ? await loc.byParent('district', member.division_id) : [],
      thanas: member.district_id ? await loc.byParent('thana', member.district_id) : [],
      postOffices: member.thana_id ? await loc.byParent('post_office', member.thana_id) : [],
      villages: member.post_office_id ? await loc.byParent('village', member.post_office_id) : [],
      areas: member.village_id ? await loc.byParent('area', member.village_id) : [],
    });
  } catch (err) {
    next(err);
  }
});

// --- Create ---
router.post('/', canWrite, photoFields, body('name').trim().notEmpty(), async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash('error', 'সদস্যের নাম আবশ্যক।');
      return res.redirect('/members/new');
    }
    const data = { ...req.body };
    data.monthly_payment = req.body.monthly_payment === 'on' || req.body.monthly_payment === 'true' || req.body.monthly_payment === 'Yes';
    for (const f of ['photo', 'spouse_photo', 'father_photo', 'mother_photo']) {
      const fn = fileName(req.files, f);
      if (fn) data[f] = fn;
    }
    const member = await members.create(data, collectChildren(req.body));
    req.flash('success', 'সদস্য যুক্ত হয়েছে (আইডি: ' + member.id_no + ')।');
    res.redirect('/members/' + member.id);
  } catch (err) {
    if (err.code === '23505') {
      req.flash('error', 'এই আইডি নম্বর আগে থেকেই আছে।');
      return res.redirect('/members/new');
    }
    next(err);
  }
});

// --- Update ---
router.post('/:id', canWrite, photoFields, async (req, res, next) => {
  try {
    const data = { ...req.body };
    data.monthly_payment = req.body.monthly_payment === 'on' || req.body.monthly_payment === 'true' || req.body.monthly_payment === 'Yes';
    for (const f of ['photo', 'spouse_photo', 'father_photo', 'mother_photo']) {
      const fn = fileName(req.files, f);
      if (fn) data[f] = fn;
      else delete data[f]; // keep existing
    }
    await members.update(req.params.id, data, collectChildren(req.body));
    req.flash('success', 'সদস্যের তথ্য হালনাগাদ হয়েছে।');
    res.redirect('/members/' + req.params.id);
  } catch (err) {
    next(err);
  }
});

// --- Archive / restore without destroying related history ---
router.post('/:id/status', adminOnly, body('status').isIn(['active', 'deactive']), async (req, res) => {
  try {
    if (!validationResult(req).isEmpty()) throw new Error('সঠিক সদস্য অবস্থা নির্বাচন করুন।');
    await members.setStatus(req.params.id, req.body.status, req.body.reason);
    req.flash('success', req.body.status === 'active' ? 'সদস্যটি পুনরায় সক্রিয় হয়েছে।' : 'সদস্যটি আর্কাইভ হয়েছে; সকল ইতিহাস সংরক্ষিত আছে।');
  } catch (err) {
    req.flash('error', err.message);
  }
  res.redirect('/members/' + req.params.id);
});

module.exports = router;
