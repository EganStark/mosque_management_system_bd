const express = require("express");
const { body, validationResult } = require("express-validator");
const { requireAuth, canWrite, adminOnly } = require("../middleware/auth");
const ops = require("../services/staff-operations");
const banks = require("../services/banks");
const mobileWallets = require("../services/mobile-wallets");
const router = express.Router();
router.use(requireAuth);
const monthNow = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const today = () => new Date().toISOString().slice(0, 10);
router.get("/", async (req, res, next) => {
  try {
    const month = /^\d{4}-\d{2}$/.test(req.query.month || "")
      ? req.query.month
      : monthNow();
    const [data, rosters] = await Promise.all([
      ops.overview(month),
      ops.rosters(),
    ]);
    res.render("staff-operations/index", {
      title: "স্টাফ অপারেশন",
      month,
      ...data,
      rosters,
    });
  } catch (err) {
    next(err);
  }
});
router.post(
  "/rosters",
  adminOnly,
  body("staff_id").isInt(),
  body("day_of_week").isIn(["sat", "sun", "mon", "tue", "wed", "thu", "fri"]),
  body("start_time").matches(/^\d{2}:\d{2}$/),
  body("end_time")
    .matches(/^\d{2}:\d{2}$/)
    .custom((v, { req }) => v > req.body.start_time),
  body("duty_name").trim().notEmpty(),
  async (req, res) => {
    try {
      if (!validationResult(req).isEmpty())
        throw new Error("ডিউটির দিন, সময় ও দায়িত্ব সঠিকভাবে দিন");
      await ops.saveRoster(req.body.staff_id, req.body);
      req.flash("success", "ডিউটি রোস্টার যুক্ত হয়েছে।");
    } catch (err) {
      req.flash("error", err.message);
    }
    res.redirect("/staff-operations");
  },
);
router.get("/attendance", async (req, res, next) => {
  try {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(req.query.date || "")
      ? req.query.date
      : today();
    res.render("staff-operations/attendance", {
      title: "স্টাফ হাজিরা",
      date,
      rows: await ops.attendanceSheet(date),
    });
  } catch (err) {
    next(err);
  }
});
router.post(
  "/attendance",
  canWrite,
  body("date").isISO8601(),
  async (req, res) => {
    try {
      const rows = Object.keys(req.body)
        .filter((k) => k.startsWith("status_"))
        .map((k) => {
          const id = k.slice(7);
          return {
            staff_id: Number(id),
            status: ["present", "absent", "late", "leave"].includes(req.body[k])
              ? req.body[k]
              : "absent",
            check_in: req.body[`check_in_${id}`],
            check_out: req.body[`check_out_${id}`],
            remarks: req.body[`remarks_${id}`],
          };
        });
      await ops.saveAttendance(req.body.date, rows, req.session.user.id);
      req.flash("success", "স্টাফ হাজিরা সংরক্ষণ হয়েছে।");
    } catch (err) {
      req.flash("error", err.message);
    }
    res.redirect(
      `/staff-operations/attendance?date=${encodeURIComponent(req.body.date || today())}`,
    );
  },
);
router.post(
  "/payroll/generate",
  adminOnly,
  body("month").matches(/^\d{4}-\d{2}$/),
  async (req, res) => {
    try {
      if (!validationResult(req).isEmpty()) throw new Error("সঠিক মাস দিন");
      const count = await ops.generatePayroll(
        req.body.month,
        req.session.user.id,
      );
      req.flash(
        "success",
        count
          ? `${count}টি বেতন হিসাব তৈরি হয়েছে।`
          : "নতুন বেতন হিসাব তৈরি হয়নি।",
      );
    } catch (err) {
      req.flash("error", err.message);
    }
    res.redirect(
      `/staff-operations?month=${encodeURIComponent(req.body.month || monthNow())}`,
    );
  },
);
router.get("/payroll/:id", async (req, res, next) => {
  try {
    const [item, bankOptions, walletOptions] = await Promise.all([
      ops.findPayroll(req.params.id),
      banks.banks.active(),
      mobileWallets.wallets.active(),
    ]);
    if (!item) return res.redirect("/staff-operations");
    res.render("staff-operations/payroll", {
      title: "বেতন হিসাব",
      item,
      banks: bankOptions,
      wallets: walletOptions,
    });
  } catch (err) {
    next(err);
  }
});
router.post("/payroll/:id/adjust", adminOnly, async (req, res) => {
  try {
    await ops.adjustPayroll(req.params.id, req.body);
    req.flash("success", "বেতন হিসাব হালনাগাদ হয়েছে।");
  } catch (err) {
    req.flash("error", err.message);
  }
  res.redirect(`/staff-operations/payroll/${req.params.id}`);
});
router.post(
  "/payroll/:id/pay",
  canWrite,
  body("amount").isFloat({ gt: 0 }),
  body("payment_date").isISO8601(),
  body("payment_method").isIn(["cash", "bank", "mobile_banking"]),
  body("bank_id").optional({ checkFalsy: true }).isInt({ min: 1 }),
  body("mobile_wallet_id").optional({ checkFalsy: true }).isInt({ min: 1 }),
  async (req, res) => {
    try {
      if (!validationResult(req).isEmpty())
        throw new Error("সঠিক পেমেন্ট তথ্য দিন");
      await ops.requestPayment(req.params.id, req.body, req.session.user.id);
      req.flash("success", "বেতন প্রদান ও খরচের হিসাবে সংরক্ষণ হয়েছে।");
    } catch (err) {
      req.flash("error", err.message);
    }
    res.redirect(`/staff-operations/payroll/${req.params.id}`);
  },
);
router.post("/payroll/:id/payment-requests/:requestId/decision", adminOnly, body("decision").isIn(["approved", "rejected"]), async (req, res) => {
  try { if (!validationResult(req).isEmpty()) throw new Error("Choose a valid payroll decision"); await ops.decidePayment(req.params.requestId, req.body.decision, req.body.decision_notes, req.session.user.id, { budget_override_reason: req.body.budget_override_reason }); req.flash("success", req.body.decision === "approved" ? "Payroll payment approved and posted." : "Payroll payment request rejected."); }
  catch (err) { req.flash("error", err.message); }
  res.redirect(`/staff-operations/payroll/${req.params.id}`);
});
module.exports = router;
