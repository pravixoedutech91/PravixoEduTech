const mongoose = require("mongoose");

const Purchase = require("../models/Purchase");
const Entitlement = require("../models/Entitlement");

const addDays = (date, days) => {
    const result = new Date(date);
    result.setDate(result.getDate() + Number(days || 0));
    return result;
};

const isNonEmptyString = (value) => {
    return typeof value === "string" && value.trim().length > 0;
};

const getPurchaseMockTestIds = (purchase) => {
    const mockTestIds =
        purchase?.productSnapshot?.includedMockTestIds || [];

    if (!Array.isArray(mockTestIds) || mockTestIds.length === 0) {
        throw new Error(
            "Paid purchase has no mock tests available for entitlement"
        );
    }

    return mockTestIds;
};

const upsertPurchaseEntitlement = async ({
    purchase,
    paidAt,
    session = null,
}) => {
    const options = {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
    };

    if (session) {
        options.session = session;
    }

    return Entitlement.findOneAndUpdate(
        {
            tenantId: purchase.tenantId,
            studentId: purchase.studentId,
            purchaseId: purchase._id,
        },
        {
            $setOnInsert: {
                tenantId: purchase.tenantId,
                studentId: purchase.studentId,
                productId: purchase.productId,
                purchaseId: purchase._id,
                entitlementType: "mock_test_pack",
                mockTestIds: getPurchaseMockTestIds(purchase),
                validFrom: paidAt,
                validUntil: addDays(
                    paidAt,
                    purchase.productSnapshot?.validityDays || 365
                ),
                status: "active",
            },
        },
        options
    );
};

const fulfillPaymentPackagePurchase = async ({
    purchase,
    razorpayPaymentId,
    razorpaySignature,
    paidAt = new Date(),
}) => {
    if (!purchase?._id) {
        throw new Error("A valid purchase is required for payment fulfilment");
    }

    getPurchaseMockTestIds(purchase);

    const normalizedPaidAt =
        paidAt instanceof Date ? paidAt : new Date(paidAt);

    if (Number.isNaN(normalizedPaidAt.getTime())) {
        throw new Error("Invalid paidAt value for payment fulfilment");
    }

    if (purchase.status === "paid") {
        const entitlement = await upsertPurchaseEntitlement({
            purchase,
            paidAt: purchase.paidAt || normalizedPaidAt,
        });

        return {
            purchase,
            entitlement,
            alreadyPaid: true,
        };
    }

    if (purchase.status !== "created") {
        throw new Error(
            `Purchase status ${purchase.status} is not eligible for fulfilment`
        );
    }

    if (!isNonEmptyString(razorpayPaymentId)) {
        throw new Error(
            "Razorpay payment ID is required for payment fulfilment"
        );
    }

    const paymentSession = await mongoose.startSession();

    let fulfilledPurchase = purchase;
    let entitlement;
    let alreadyPaid = false;

    try {
        await paymentSession.withTransaction(async () => {
            const currentPurchase = await Purchase.findOne({
                _id: purchase._id,
                tenantId: purchase.tenantId,
                studentId: purchase.studentId,
                provider: "razorpay",
            }).session(paymentSession);

            if (!currentPurchase) {
                throw new Error(
                    "Purchase was not found during payment fulfilment"
                );
            }

            if (currentPurchase.status === "paid") {
                if (
                    currentPurchase.razorpayPaymentId &&
                    currentPurchase.razorpayPaymentId !==
                        razorpayPaymentId.trim()
                ) {
                    throw new Error(
                        "Purchase is already linked to a different Razorpay payment"
                    );
                }

                fulfilledPurchase = currentPurchase;
                alreadyPaid = true;

                entitlement = await upsertPurchaseEntitlement({
                    purchase: currentPurchase,
                    paidAt:
                        currentPurchase.paidAt ||
                        normalizedPaidAt,
                    session: paymentSession,
                });

                return;
            }

            if (currentPurchase.status !== "created") {
                throw new Error(
                    `Purchase status ${currentPurchase.status} is not eligible for fulfilment`
                );
            }

            entitlement = await upsertPurchaseEntitlement({
                purchase: currentPurchase,
                paidAt: normalizedPaidAt,
                session: paymentSession,
            });

            currentPurchase.status = "paid";
            currentPurchase.razorpayPaymentId =
                razorpayPaymentId.trim();

            if (isNonEmptyString(razorpaySignature)) {
                currentPurchase.razorpaySignature =
                    razorpaySignature.trim();
            }

            currentPurchase.paidAt = normalizedPaidAt;
            currentPurchase.failureReason = undefined;

            await currentPurchase.save({
                session: paymentSession,
            });

            fulfilledPurchase = currentPurchase;
        });
    } catch (error) {
        if (error?.code === 11000) {
            const paidPurchase = await Purchase.findOne({
                _id: purchase._id,
                tenantId: purchase.tenantId,
                studentId: purchase.studentId,
                provider: "razorpay",
                status: "paid",
                razorpayPaymentId: razorpayPaymentId.trim(),
            });

            const existingEntitlement = paidPurchase
                ? await Entitlement.findOne({
                      tenantId: paidPurchase.tenantId,
                      studentId: paidPurchase.studentId,
                      purchaseId: paidPurchase._id,
                  })
                : null;

            if (paidPurchase && existingEntitlement) {
                return {
                    purchase: paidPurchase,
                    entitlement: existingEntitlement,
                    alreadyPaid: true,
                };
            }
        }

        throw error;
    } finally {
        await paymentSession.endSession();
    }

    if (!entitlement) {
        throw new Error(
            "Payment fulfilment transaction did not return an entitlement"
        );
    }

    return {
        purchase: fulfilledPurchase,
        entitlement,
        alreadyPaid,
    };
};

module.exports = {
    fulfillPaymentPackagePurchase,
};