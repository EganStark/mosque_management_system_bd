const express = require("express");
const { body, validationResult } = require("express-validator");
const { requireAuth, canWrite, adminOnly } = require("../middleware/auth");
const maintenance = require("../services/maintenance");
const banks = require("../services/banks");
const mobileWallets = require("../services/mobile-wallets");
const router = express.Router();
router.use(requireAuth);
const today = () => new Date().toISOString().slice(0, 10);
async function formOptions() {
  return {
    assets: await maintenance.options.assets(),
    facilities: await maintenance.options.facilities(),
    staff: await maintenance.options.staff(),
    vendors: await maintenance.options.vendors(),
  };
}
router.get("/", async (req, res, next) => {
  try {
    const [rows, summary] = await Promise.all([
      maintenance.list(),
      maintenance.summary(),
    ]);
    res.render("maintenance/list", { title: "রক্ষণাবেক্ষণ", rows, summary });
  } catch (err) {
    next(err);
  }
});
router.get("/new", canWrite, async (req, res, next) => {
  try {
    res.render("maintenance/form", {
      title: "নতুন কাজের আদেশ",
      today: today(),
      ...(await formOptions()),
    });
  } catch (err) {
    next(err);
  }
});
router.post(
  "/",
  canWrite,
  body("title").trim().notEmpty(),
  body("description").trim().notEmpty(),
  body("maintenance_type").isIn([
    "inspection",
    "service",
    "repair",
    "replacement",
    "building",
  ]),
  body("priority").isIn(["low", "normal", "high", "critical"]),
  body("reported_date").isISO8601(),
  async (req, res) => {
    try {
      if (!validationResult(req).isEmpty())
        throw new Error("কাজের প্রয়োজনীয় তথ্য সঠিকভাবে দিন");
      const item = await maintenance.create(req.body, req.session.user.id);
      req.flash("success", "কাজের আদেশ তৈরি হয়েছে।");
      res.redirect(`/maintenance/${item.id}`);
    } catch (err) {
      req.flash("error", err.message);
      res.redirect("/maintenance/new");
    }
  },
);
router.post(
  "/vendors",
  adminOnly,
  body("name").trim().notEmpty(),
  async (req, res) => {
    try {
      if (!validationResult(req).isEmpty())
        throw new Error("সেবাদাতার নাম দিন");
      await maintenance.createVendor(req.body);
      req.flash("success", "সেবাদাতা যুক্ত হয়েছে।");
    } catch (err) {
      req.flash("error", err.message);
    }
    res.redirect("/maintenance/new");
  },
);
router.get("/:id", async (req, res, next) => {
  try {
    const [item, bankOptions, walletOptions] = await Promise.all([
      maintenance.find(req.params.id),
      banks.banks.active(),
      mobileWallets.wallets.active(),
    ]);
    if (!item) return res.redirect("/maintenance");
    res.render("maintenance/view", {
      title: item.work_order_no,
      item,
      banks: bankOptions,
      wallets: walletOptions,
    });
  } catch (err) {
    next(err);
  }
});
router.post(
  "/:id/status",
  canWrite,
  body("status").isIn(["open", "assigned", "in_progress", "cancelled"]),
  async (req, res) => {
    try {
      if (!validationResult(req).isEmpty()) throw new Error("সঠিক অবস্থা দিন");
      await maintenance.setStatus(req.params.id, req.body.status);
      req.flash("success", "কাজের অবস্থা হালনাগাদ হয়েছে।");
    } catch (err) {
      req.flash("error", err.message);
    }
    res.redirect(`/maintenance/${req.params.id}`);
  },
);
router.post(
  "/:id/complete",
  canWrite,
  body("completed_date").isISO8601(),
  body("actual_cost").isFloat({ min: 0 }),
  body("payment_method").isIn(["cash", "bank", "mobile_banking"]),
  body("bank_id").optional({ checkFalsy: true }).isInt({ min: 1 }),
  body("mobile_wallet_id").optional({ checkFalsy: true }).isInt({ min: 1 }),
  async (req, res) => {
    try {
      if (!validationResult(req).isEmpty())
        throw new Error("সমাপ্তির তারিখ ও খরচ সঠিকভাবে দিন");
      await maintenance.requestCompletion(req.params.id, req.body, req.session.user.id);
      req.flash(
        "success",
        "সমাপ্তির অনুরোধ অনুমোদনের জন্য পাঠানো হয়েছে।",
      );
    } catch (err) {
      req.flash("error", err.message);
    }
    res.redirect(`/maintenance/${req.params.id}`);
  },
);
router.post(
  "/:id/completion-requests/:requestId/decision",
  adminOnly,
  body("decision").isIn(["approved", "rejected"]),
  async (req, res) => {
    try {
      if (!validationResult(req).isEmpty()) throw new Error("Choose a valid completion decision");
      await maintenance.decideCompletion(req.params.requestId, req.body.decision, req.body.decision_notes, req.session.user.id);
      req.flash("success", req.body.decision === "approved" ? "Completion approved and expense posted." : "Completion request rejected.");
    } catch (err) { req.flash("error", err.message); }
    res.redirect(`/maintenance/${req.params.id}`);
  },
);
module.exports = router;
