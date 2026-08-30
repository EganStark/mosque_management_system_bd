const express = require("express");
const { body, validationResult } = require("express-validator");
const { requireAuth, canWrite } = require("../middleware/auth");
const pledges = require("../services/pledges");
const members = require("../services/members");
const collections = require("../services/collections");
const banks = require("../services/banks");
const mobileWallets = require("../services/mobile-wallets");
const router = express.Router();
router.use(requireAuth);
router.get("/", async (req, res, next) => {
  try {
    await pledges.refreshOverdue();
    const [rows, summary, memberOptions, categories, bankOptions] =
      await Promise.all([
        pledges.list({ status: req.query.status }),
        pledges.summary(),
        members.options(),
        collections.categories.all(),
        banks.banks.active(),
      ]);
    res.render("pledges/list", {
      title: "দান অঙ্গীকার ও বকেয়া",
      rows,
      summary,
      memberOptions,
      categories,
      banks: bankOptions,
      status: req.query.status || "",
    });
  } catch (e) {
    next(e);
  }
});
router.post(
  "/",
  canWrite,
  body("donor_name").trim().notEmpty(),
  body("purpose").trim().notEmpty(),
  body("pledged_amount").isFloat({ gt: 0 }),
  body("pledge_date").isISO8601(),
  async (req, res) => {
    try {
      if (!validationResult(req).isEmpty())
        throw new Error("অঙ্গীকারের প্রয়োজনীয় তথ্য সঠিকভাবে দিন");
      const p = await pledges.create(req.body, req.session.user.id);
      req.flash("success", "দানের অঙ্গীকার সংরক্ষিত হয়েছে।");
      res.redirect(`/pledges/${p.id}`);
    } catch (e) {
      req.flash("error", e.message);
      res.redirect("/pledges");
    }
  },
);
router.get("/:id", async (req, res, next) => {
  try {
    const [item, bankOptions, walletOptions] = await Promise.all([
      pledges.find(req.params.id),
      banks.banks.active(),
      mobileWallets.wallets.active(),
    ]);
    if (!item) return res.redirect("/pledges");
    res.render("pledges/view", {
      title: item.pledge_no,
      item,
      banks: bankOptions,
      wallets: walletOptions,
    });
  } catch (e) {
    next(e);
  }
});
router.post(
  "/:id/payments",
  canWrite,
  body("amount").isFloat({ gt: 0 }),
  body("payment_date").isISO8601(),
  body("payment_method").isIn(["cash", "bank", "mobile_banking"]),
  body("bank_id").optional({ checkFalsy: true }).isInt({ min: 1 }),
  body("mobile_wallet_id").optional({ checkFalsy: true }).isInt({ min: 1 }),
  async (req, res) => {
    try {
      if (!validationResult(req).isEmpty())
        throw new Error("পরিশোধের তথ্য সঠিকভাবে দিন");
      const c = await pledges.pay(req.params.id, req.body, req.session.user.id);
      req.flash("success", "পরিশোধ গ্রহণ করে রশিদ তৈরি হয়েছে।");
      return res.redirect(`/collections/${c.id}/receipt`);
    } catch (e) {
      req.flash("error", e.message);
      return res.redirect(`/pledges/${req.params.id}`);
    }
  },
);
router.post(
  "/:id/follow-up",
  canWrite,
  body("follow_up_status").isIn([
    "not_contacted",
    "contacted",
    "promised",
    "unreachable",
    "declined",
  ]),
  async (req, res) => {
    try {
      if (!validationResult(req).isEmpty())
        throw new Error("ফলো-আপ অবস্থা নির্বাচন করুন");
      await pledges.followUp(req.params.id, req.body);
      req.flash("success", "ফলো-আপ তথ্য হালনাগাদ হয়েছে।");
    } catch (e) {
      req.flash("error", e.message);
    }
    res.redirect(`/pledges/${req.params.id}`);
  },
);
module.exports = router;
