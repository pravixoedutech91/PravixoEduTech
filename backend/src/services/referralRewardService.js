const {
    logRuntimeError,
} = require("../utils/runtimeSecurity");

const ReferralAttribution =
    require("../models/ReferralAttribution");
const ReferralPartner =
    require("../models/ReferralPartner");
const ReferralReward =
    require("../models/ReferralReward");
const ReferralSettings =
    require("../models/ReferralSettings");
const Tenant =
    require("../models/Tenant");

const calculateReferralRewardAmountInPaise = ({
    commissionType,
    commissionValue,
    purchaseAmountInPaise,
}) => {
    const cleanCommissionValue =
        Number(commissionValue || 0);

    const cleanPurchaseAmount =
        Number(purchaseAmountInPaise || 0);

    if (
        !Number.isFinite(cleanCommissionValue) ||
        cleanCommissionValue <= 0 ||
        !Number.isFinite(cleanPurchaseAmount) ||
        cleanPurchaseAmount <= 0
    ) {
        return 0;
    }

    if (commissionType === "percentage") {
        return Math.max(
            0,
            Math.round(
                (
                    cleanPurchaseAmount *
                    cleanCommissionValue
                ) / 100
            )
        );
    }

    return Math.max(
        0,
        Math.round(cleanCommissionValue)
    );
};

const MILLISECONDS_PER_DAY =
    24 * 60 * 60 * 1000;

const calculateReferralEligibleAt = ({
    paidAt,
    rewardLockDays,
    refundSafetyDays,
}) => {
    const normalizedPaidAt =
        paidAt instanceof Date
            ? paidAt
            : new Date(paidAt);

    if (
        Number.isNaN(
            normalizedPaidAt.getTime()
        )
    ) {
        return null;
    }

    const normalizedRewardLockDays =
        Math.max(
            0,
            Number.parseInt(
                rewardLockDays,
                10
            ) || 0
        );

    const normalizedRefundSafetyDays =
        Math.max(
            0,
            Number.parseInt(
                refundSafetyDays,
                10
            ) || 0
        );

    return new Date(
        normalizedPaidAt.getTime() +
        (
            normalizedRewardLockDays +
            normalizedRefundSafetyDays
        ) *
        MILLISECONDS_PER_DAY
    );
};

const createPendingReferralRewardForPaidPurchase =
    async ({ purchase }) => {
        if (!purchase || purchase.status !== "paid") {
            return null;
        }

        try {
            const existingReward =
                await ReferralReward.findOne({
                    tenantId: purchase.tenantId,
                    purchaseId: purchase._id,
                });

            if (existingReward) {
                return existingReward;
            }

            const [
                tenant,
                referralSettings,
            ] = await Promise.all([
                Tenant.findOne({
                    slug: purchase.tenantId,
                    isActive: true,
                })
                    .select("features.referrals")
                    .lean(),
                ReferralSettings.findOne({
                    tenantId: purchase.tenantId,
                }).lean(),
            ]);

            if (
                !tenant?.features?.referrals ||
                !referralSettings?.isReferralEnabled
            ) {
                return null;
            }

            const attribution =
                await ReferralAttribution.findOne({
                    tenantId: purchase.tenantId,
                    studentId: purchase.studentId,
                    status: "active",
                })
                    .sort({ createdAt: -1 })
                    .lean();

            if (!attribution) {
                return null;
            }

            const partner =
                await ReferralPartner.findOne({
                    _id: attribution.referralPartnerId,
                    tenantId: purchase.tenantId,
                    status: "active",
                }).lean();

            if (!partner) {
                return null;
            }

            const eligibleAt =
                calculateReferralEligibleAt({
                    paidAt: purchase.paidAt,
                    rewardLockDays:
                        referralSettings.rewardLockDays ?? 7,
                    refundSafetyDays:
                        referralSettings.refundSafetyDays ?? 7,
                });

            if (!eligibleAt) {
                return null;
            }

            const rewardAmountInPaise =
                calculateReferralRewardAmountInPaise({
                    commissionType:
                        partner.commissionType,
                    commissionValue:
                        partner.commissionValue,
                    purchaseAmountInPaise:
                        purchase.amountInPaise,
                });

            if (rewardAmountInPaise < 1) {
                return null;
            }

            return await ReferralReward.findOneAndUpdate(
                {
                    tenantId: purchase.tenantId,
                    purchaseId: purchase._id,
                },
                {
                    $setOnInsert: {
                        tenantId: purchase.tenantId,
                        referralPartnerId: partner._id,
                        studentId: purchase.studentId,
                        purchaseId: purchase._id,
                        productId: purchase.productId,
                        purchaseAmountInPaise:
                            purchase.amountInPaise,
                        rewardAmountInPaise,
                        eligibleAt,
                        status: "pending",
                        createdBy: purchase.studentId,
                        updatedBy: purchase.studentId,
                    },
                },
                {
                    upsert: true,
                    returnDocument: "after",
                    setDefaultsOnInsert: true,
                }
            );
        } catch (error) {
            if (error?.code === 11000) {
                return await ReferralReward.findOne({
                    tenantId: purchase.tenantId,
                    purchaseId: purchase._id,
                });
            }

            logRuntimeError(
                "Create pending referral reward error:",
                error
            );

            return null;
        }
    };

module.exports = {
    calculateReferralRewardAmountInPaise,
    calculateReferralEligibleAt,
    createPendingReferralRewardForPaidPurchase,
};
