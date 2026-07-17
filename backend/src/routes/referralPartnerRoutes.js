const express = require("express");
const router = express.Router();

const {
  adminRoles,
  getReferralRewards,
  getReferralAttributions,
  getReferralPartners,
  getReferralPartnerById,
  createReferralPartner,
  updateReferralPartner,
  activateReferralPartner,
  suspendReferralPartner,
  rejectReferralPartner,
} = require("../controllers/referralPartnerController");

const {
  protect,
  authorize,
} = require("../middleware/authMiddleware");

const {
  ensureTenantAccess,
  checkFeatureAccess,
} = require("../middleware/tenantMiddleware");

router.get(
  "/",
  protect,
  authorize(...adminRoles),
  checkFeatureAccess("referrals"),
  getReferralPartners
);

router.post(
  "/",
  protect,
  authorize(...adminRoles),
  checkFeatureAccess("referrals"),
  ensureTenantAccess,
  createReferralPartner
);

router.get(
  "/attributions",
  protect,
  authorize(...adminRoles),
  checkFeatureAccess("referrals"),
  getReferralAttributions
);


router.get(
  "/rewards",
  protect,
  authorize(...adminRoles),
  checkFeatureAccess("referrals"),
  getReferralRewards
);

router.get(
  "/:id",
  protect,
  authorize(...adminRoles),
  checkFeatureAccess("referrals"),
  getReferralPartnerById
);

router.put(
  "/:id",
  protect,
  authorize(...adminRoles),
  checkFeatureAccess("referrals"),
  ensureTenantAccess,
  updateReferralPartner
);

router.patch(
  "/:id/activate",
  protect,
  authorize(...adminRoles),
  checkFeatureAccess("referrals"),
  ensureTenantAccess,
  activateReferralPartner
);

router.patch(
  "/:id/suspend",
  protect,
  authorize(...adminRoles),
  checkFeatureAccess("referrals"),
  ensureTenantAccess,
  suspendReferralPartner
);

router.patch(
  "/:id/reject",
  protect,
  authorize(...adminRoles),
  checkFeatureAccess("referrals"),
  ensureTenantAccess,
  rejectReferralPartner
);

module.exports = router;
