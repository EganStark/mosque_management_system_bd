const express = require("express");
const { body, validationResult } = require("express-validator");
const { requireAuth, canWrite, adminOnly } = require("../middleware/auth");
const bookings = require("../services/bookings");
const members = require("../services/members");
const banks = require("../services/banks");
const mobileWallets = require("../services/mobile-wallets");
const router = express.Router();
router.use(requireAuth);
const bookingValidation = [
  body("facility_id").isInt(),
  body("event_title").trim().notEmpty(),
  body("booking_type").isIn([
    "nikah",
    "aqiqah",
    "meeting",
    "education",
    "community",
    "iftar",
    "other",
  ]),
  body("booking_date").isISO8601(),
  body("start_time").matches(/^\d{2}:\d{2}$/),
  body("end_time")
    .matches(/^\d{2}:\d{2}$/)
    .custom((value, { req }) => value > req.body.start_time),
];
router.get("/", async (req, res, next) => {
  try {
    const [rows, summary] = await Promise.all([
      bookings.list(req.query),
      bookings.summary(),
    ]);
    res.render("bookings/list", {
      title: "সুবিধা ও বুকিং",
      rows,
      summary,
      filters: req.query,
    });
  } catch (err) {
    next(err);
  }
});
router.get("/new", canWrite, async (req, res, next) => {
  try {
    res.render("bookings/form", {
      title: "নতুন বুকিং",
      facilities: await bookings.facilities.all(),
      memberOptions: await members.options(),
    });
  } catch (err) {
    next(err);
  }
});
router.post("/", canWrite, bookingValidation, async (req, res) => {
  try {
    if (!validationResult(req).isEmpty())
      throw new Error("স্থান, তারিখ এবং সঠিক সময়সহ প্রয়োজনীয় তথ্য দিন");
    if (
      !req.body.member_id &&
      (!req.body.requester_name || !req.body.requester_phone)
    )
      throw new Error("আবেদনকারীর নাম ও মোবাইল দিন");
    const item = await bookings.create(req.body, req.session.user.id);
    req.flash("success", "বুকিং আবেদন তৈরি হয়েছে।");
    res.redirect(`/bookings/${item.id}`);
  } catch (err) {
    req.flash("error", err.message);
    res.redirect("/bookings/new");
  }
});
router.get("/:id", async (req, res, next) => {
  try {
    const [item, bankOptions, walletOptions] = await Promise.all([
      bookings.find(req.params.id),
      banks.banks.active(),
      mobileWallets.wallets.active(),
    ]);
    if (!item) return res.redirect("/bookings");
    res.render("bookings/view", {
      title: item.booking_no,
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
  adminOnly,
  body("status").isIn(["approved", "cancelled", "completed"]),
  async (req, res) => {
    try {
      if (!validationResult(req).isEmpty())
        throw new Error("সঠিক অবস্থা নির্বাচন করুন");
      await bookings.setStatus(
        req.params.id,
        req.body.status,
        req.session.user.id,
      );
      req.flash("success", "বুকিংয়ের অবস্থা হালনাগাদ হয়েছে।");
    } catch (err) {
      req.flash("error", err.message);
    }
    res.redirect(`/bookings/${req.params.id}`);
  },
);
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
        throw new Error("সঠিক পেমেন্ট তথ্য দিন");
      await bookings.addPayment(req.params.id, req.body, req.session.user.id);
      req.flash("success", "পেমেন্ট সংরক্ষণ হয়েছে।");
    } catch (err) {
      req.flash("error", err.message);
    }
    res.redirect(`/bookings/${req.params.id}`);
  },
);
module.exports = router;
