const express = require("express");
const { body, validationResult } = require("express-validator");
const { requireAuth, canWrite, adminOnly } = require("../middleware/auth");
const welfare = require("../services/welfare");
const members = require("../services/members");
const banks = require("../services/banks");
const mobileWallets = require("../services/mobile-wallets");
const router = express.Router();
router.use(requireAuth);
router.get("/", async (req, res, next) => {
  try {
    const [rows, summary, beneficiaries, memberOptions] = await Promise.all([
      welfare.list(),
      welfare.summary(),
      welfare.beneficiaryOptions(),
      members.options(),
    ]);
    res.render("welfare/list", {
      title: "কল্যাণ ও সহায়তা",
      rows,
      summary,
      beneficiaries,
      memberOptions,
    });
  } catch (err) {
    next(err);
  }
});
router.post(
  "/beneficiaries",
  canWrite,
  body("member_id").optional({ checkFalsy: true }).isInt(),
  async (req, res) => {
    try {
      if (!req.body.member_id && !String(req.body.name || "").trim())
        throw new Error("সদস্য নির্বাচন করুন অথবা উপকারভোগীর নাম লিখুন");
      await welfare.createBeneficiary(req.body, req.session.user.id);
      req.flash("success", "উপকারভোগী নিবন্ধিত হয়েছে।");
    } catch (err) {
      req.flash("error", err.message);
    }
    res.redirect("/welfare");
  },
);
router.post(
  "/beneficiaries/:id/verify",
  adminOnly,
  body("eligibility_status").isIn(["eligible", "ineligible", "pending"]),
  async (req, res) => {
    try {
      if (!validationResult(req).isEmpty())
        throw new Error("সঠিক যোগ্যতার অবস্থা দিন");
      await welfare.verifyBeneficiary(
        req.params.id,
        req.body.eligibility_status,
        req.body.verification_notes,
        req.session.user.id,
      );
      req.flash("success", "যোগ্যতা যাচাই হালনাগাদ হয়েছে।");
    } catch (err) {
      req.flash("error", err.message);
    }
    res.redirect("/welfare");
  },
);
router.post(
  "/applications",
  canWrite,
  body("beneficiary_id").isInt(),
  body("assistance_type").isIn([
    "medical",
    "food",
    "education",
    "housing",
    "emergency",
    "livelihood",
    "other",
  ]),
  body("fund_source").isIn(["zakat", "sadaqah", "general", "emergency"]),
  body("requested_amount").isFloat({ gt: 0 }),
  body("reason").trim().notEmpty(),
  async (req, res) => {
    try {
      if (!validationResult(req).isEmpty())
        throw new Error("আবেদনটির প্রয়োজনীয় তথ্য সঠিকভাবে দিন");
      const item = await welfare.createApplication(
        req.body,
        req.session.user.id,
      );
      req.flash("success", "সহায়তার আবেদন তৈরি হয়েছে।");
      res.redirect(`/welfare/${item.id}`);
    } catch (err) {
      req.flash("error", err.message);
      res.redirect("/welfare");
    }
  },
);
router.get("/:id", async (req, res, next) => {
  try {
    const [item, bankOptions, walletOptions] = await Promise.all([
      welfare.find(req.params.id),
      banks.banks.active(),
      mobileWallets.wallets.active(),
    ]);
    if (!item) return res.redirect("/welfare");
    res.render("welfare/view", {
      title: item.application_no,
      item,
      banks: bankOptions,
      wallets: walletOptions,
    });
  } catch (err) {
    next(err);
  }
});
router.post(
  "/:id/decision",
  adminOnly,
  body("status").isIn(["approved", "rejected"]),
  async (req, res) => {
    try {
      if (!validationResult(req).isEmpty())
        throw new Error("সঠিক সিদ্ধান্ত দিন");
      await welfare.decide(req.params.id, req.body, req.session.user.id);
      req.flash("success", "আবেদনের সিদ্ধান্ত সংরক্ষণ হয়েছে।");
    } catch (err) {
      req.flash("error", err.message);
    }
    res.redirect(`/welfare/${req.params.id}`);
  },
);
router.post(
  "/:id/disbursements",
  canWrite,
  body("amount").isFloat({ gt: 0 }),
  body("disbursement_date").isISO8601(),
  body("payment_method").isIn(["cash", "bank", "mobile_banking"]),
  body("bank_id").optional({ checkFalsy: true }).isInt({ min: 1 }),
  body("mobile_wallet_id").optional({ checkFalsy: true }).isInt({ min: 1 }),
  async (req, res) => {
    try {
      if (!validationResult(req).isEmpty())
        throw new Error("সঠিক বিতরণ তথ্য দিন");
      await welfare.requestDisbursement(req.params.id, req.body, req.session.user.id);
      req.flash("success", "বিতরণের অনুরোধ অ্যাডমিন অনুমোদনের জন্য জমা হয়েছে; এখনও অর্থ ছাড় হয়নি।");
    } catch (err) {
      req.flash("error", err.message);
    }
    res.redirect(`/welfare/${req.params.id}`);
  },
);
router.post(
  "/:id/disbursements/:requestId/decision",
  adminOnly,
  body("decision").isIn(["approve", "reject"]),
  async (req, res) => {
    try {
      if (!validationResult(req).isEmpty()) throw new Error("সঠিক সিদ্ধান্ত দিন");
      await welfare.decideDisbursement(req.params.requestId, req.body.decision, req.body.decision_notes, req.session.user.id, {
        budget_override_reason: req.body.budget_override_reason,
      });
      req.flash("success", req.body.decision === "approve" ? "বিতরণ অনুমোদিত; অর্থ ছাড় ও খরচ ভাউচার তৈরি হয়েছে।" : "বিতরণের অনুরোধ প্রত্যাখ্যাত হয়েছে।");
    } catch (err) { req.flash("error", err.message); }
    res.redirect(`/welfare/${req.params.id}`);
  },
);
module.exports = router;
