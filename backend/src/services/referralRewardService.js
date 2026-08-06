const {
    logRuntimeError,
} = require("../utils/runtimeSecurity");

const ReferralAttribution =
    require("../models/ReferralAttribution");
const ReferralPartner =
    require("../models/ReferralPartner");
const ReferralReward =
    require("../models/ReferralReward");

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
    createPendingReferralRewardForPaidPurchase,
};