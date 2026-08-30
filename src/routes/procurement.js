const express = require("express");
const { body, validationResult } = require("express-validator");
const { requireAuth, canWrite, adminOnly } = require("../middleware/auth");
const procurement = require("../services/procurement");
const mobileWallets = require("../services/mobile-wallets");
const router = express.Router();
router.use(requireAuth);
router.get("/", async (req, res, next) => {
  try {
    const [rows, summary] = await Promise.all([
      procurement.list(),
      procurement.summary(),
    ]);
    res.render("procurement/list", { title: "ক্রয় ও সরবরাহ", rows, summary });
  } catch (e) {
    next(e);
  }
});
router.get("/new", canWrite, async (req, res, next) => {
  try {
    res.render("procurement/form", {
      title: "নতুন ক্রয় অনুরোধ",
      ...(await procurement.options()),
    });
  } catch (e) {
    next(e);
  }
});
router.post(
  "/",
  canWrite,
  body("title").trim().notEmpty(),
  body("justification").trim().notEmpty(),
  body("request_date").isISO8601(),
  body("priority").isIn(["low", "normal", "high", "critical"]),
  async (req, res) => {
    try {
      if (!validationResult(req).isEmpty())
        throw new Error("অনুরোধের শিরোনাম, কারণ ও তারিখ দিন।");
      const item = await procurement.create(req.body, req.session.user.id);
      req.flash("success", "ক্রয় অনুরোধের খসড়া তৈরি হয়েছে।");
      res.redirect(`/procurement/${item.id}`);
    } catch (e) {
      req.flash("error", e.message);
      res.redirect("/procurement/new");
    }
  },
);
router.post("/:id/submit", canWrite, async (req, res) => {
  try {
    await procurement.submit(req.params.id);
    req.flash("success", "অনুমোদনের জন্য পাঠানো হয়েছে।");
  } catch (e) {
    req.flash("error", e.message);
  }
  res.redirect(`/procurement/${req.params.id}`);
});
router.post(
  "/:id/decision",
  adminOnly,
  body("status").isIn(["approved", "rejected"]),
  async (req, res) => {
    try {
      if (!validationResult(req).isEmpty())
        throw new Error("সঠিক সিদ্ধান্ত দিন।");
      await procurement.decide(
        req.params.id,
        req.body.status,
        req.body.decision_notes,
        req.session.user.id,
      );
      req.flash("success", "সিদ্ধান্ত সংরক্ষণ হয়েছে।");
    } catch (e) {
      req.flash("error", e.message);
    }
    res.redirect(`/procurement/${req.params.id}`);
  },
);
router.post(
  "/:id/quotations",
  canWrite,
  body("vendor_id").isInt(),
  body("quotation_date").isISO8601(),
  body("quoted_amount").isFloat({ gt: 0 }),
  async (req, res) => {
    try {
      if (!validationResult(req).isEmpty())
        throw new Error("বিক্রেতা, তারিখ ও দর সঠিকভাবে দিন।");
      await procurement.addQuotation(
        req.params.id,
        req.body,
        req.session.user.id,
      );
      req.flash("success", "দরপত্র সংরক্ষণ হয়েছে।");
    } catch (e) {
      req.flash("error", e.message);
    }
    res.redirect(`/procurement/${req.params.id}`);
  },
);
router.post(
  "/:id/order",
  adminOnly,
  body("quotation_id").isInt(),
  body("order_date").isISO8601(),
  async (req, res) => {
    try {
      if (!validationResult(req).isEmpty())
        throw new Error("দরপত্র ও অর্ডারের তারিখ নির্বাচন করুন।");
      await procurement.createOrder(
        req.params.id,
        req.body,
        req.session.user.id,
      );
      req.flash("success", "ক্রয় আদেশ জারি হয়েছে।");
    } catch (e) {
      req.flash("error", e.message);
    }
    res.redirect(`/procurement/${req.params.id}`);
  },
);
router.post(
  "/orders/:id/receive",
  canWrite,
  body("received_date").isISO8601(),
  body("inspection_notes").trim().notEmpty(),
  body("condition_status").isIn(["accepted", "partial", "rejected"]),
  async (req, res) => {
    const requestId = req.body.request_id;
    try {
      if (!validationResult(req).isEmpty())
        throw new Error("গ্রহণ ও পরিদর্শনের তথ্য দিন।");
      await procurement.receive(req.params.id, req.body, req.session.user.id);
      req.flash("success", "পণ্য গ্রহণ রেকর্ড হয়েছে।");
    } catch (e) {
      req.flash("error", e.message);
    }
    res.redirect(requestId ? `/procurement/${requestId}` : "/procurement");
  },
);
router.post(
  "/orders/:id/pay",
  canWrite,
  body("amount").isFloat({ gt: 0 }),
  body("payment_date").isISO8601(),
  body("payment_method").isIn(["cash", "bank", "mobile_banking"]),
  body("bank_id").optional({ checkFalsy: true }).isInt({ min: 1 }),
  body("mobile_wallet_id").optional({ checkFalsy: true }).isInt({ min: 1 }),
  async (req, res) => {
    const requestId = req.body.request_id;
    try {
      if (!validationResult(req).isEmpty())
        throw new Error("পেমেন্টের তথ্য সঠিকভাবে দিন।");
      await procurement.requestPayment(req.params.id, req.body, req.session.user.id);
      req.flash("success", "পেমেন্ট ও খরচের ভাউচার সংরক্ষণ হয়েছে।");
    } catch (e) {
      req.flash("error", e.message);
    }
    res.redirect(requestId ? `/procurement/${requestId}` : "/procurement");
  },
);
router.post(
  "/orders/:orderId/payments/:paymentRequestId/decision",
  adminOnly,
  body("decision").isIn(["approved", "rejected"]),
  async (req, res) => {
    const requestId = req.body.request_id;
    try {
      if (!validationResult(req).isEmpty()) throw new Error("Choose a valid payment decision");
      await procurement.decidePayment(req.params.paymentRequestId, req.body.decision, req.body.decision_notes, req.session.user.id, { budget_override_reason: req.body.budget_override_reason });
      req.flash("success", req.body.decision === "approved" ? "Supplier payment approved and posted." : "Supplier payment request rejected.");
    } catch (e) {
      req.flash("error", e.message);
    }
    res.redirect(requestId ? `/procurement/${requestId}` : "/procurement");
  },
);
router.post(
  "/orders/:orderId/payments/:paymentId/cancel",
  adminOnly,
  body("cancellation_reason").trim().notEmpty(),
  async (req, res) => {
    const requestId = req.body.request_id;
    try {
      if (!validationResult(req).isEmpty()) throw new Error("Enter a cancellation reason");
      await procurement.cancelPayment(req.params.orderId, req.params.paymentId, req.body.cancellation_reason, req.session.user.id);
      req.flash("success", "Supplier payment cancelled and the order balance restored.");
    } catch (e) {
      req.flash("error", e.message);
    }
    res.redirect(requestId ? `/procurement/${requestId}` : "/procurement");
  },
);
router.get("/:id", async (req, res, next) => {
  try {
    const [item, opts, walletOptions] = await Promise.all([
      procurement.find(req.params.id),
      procurement.options(),
      mobileWallets.wallets.active(),
    ]);
    if (!item) return res.redirect("/procurement");
    res.render("procurement/view", {
      title: item.request_no,
      item,
      vendors: opts.vendors,
      banks: opts.banks,
      wallets: walletOptions,
    });
  } catch (e) {
    next(e);
  }
});
module.exports = router;
