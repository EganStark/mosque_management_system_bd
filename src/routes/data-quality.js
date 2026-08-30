const express = require("express");
const { body, validationResult } = require("express-validator");
const { requireAuth, adminOnly } = require("../middleware/auth");
const db = require("../config/db");
const quality = require("../services/data-quality");

const router = express.Router();

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const [data, banks, mobileWallets] = await Promise.all([
      quality.audit(),
      db("banks").where({ is_active: true }).orderBy("name"),
      db("mobile_wallets").where({ is_active: true }).orderBy(["provider", "name"]),
    ]);
    res.render("data-quality/index", {
      title: "ডেটা স্বাস্থ্য",
      data,
      banks,
      mobileWallets,
    });
  } catch (error) {
    next(error);
  }
});

router.post(
  "/collections/:id/account",
  adminOnly,
  body("bank_id").optional({ checkFalsy: true }).isInt({ min: 1 }),
  body("mobile_wallet_id").optional({ checkFalsy: true }).isInt({ min: 1 }),
  async (req, res) => {
    try {
      if (!validationResult(req).isEmpty())
        throw new Error("সঠিক হিসাব নির্বাচন করুন");
      await quality.repairCollectionAccount(req.params.id, req.body);
      req.flash("success", "আদায়ের গ্রহণকারী হিসাব সংশোধন হয়েছে।");
    } catch (error) {
      req.flash("error", error.message);
    }
    res.redirect("/data-quality");
  },
);

module.exports = router;
