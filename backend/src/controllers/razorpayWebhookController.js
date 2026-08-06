const Purchase = require("../models/Purchase");
const RazorpayWebhookEvent =
    require("../models/RazorpayWebhookEvent");

const {
    fulfillPaymentPackagePurchase,
} = require("../services/paymentFulfillmentService");

const {
    createPendingReferralRewardForPaidPurchase,
} = require("../services/referralRewardService");

const {
    getPayloadCreatedAt,
    parseRazorpayWebhookPayload,
    verifyRazorpayWebhookSignature,
} = require("../services/razorpayWebhookService");

const {
    logRuntimeError,
} = require("../utils/runtimeSecurity");

const isNonEmptyString = (value) => {
    return typeof value === "string" && value.trim().length > 0;
};

const recordWebhookEvent = async ({
    eventId,
    eventType,
    status,
    purchase,
    razorpayOrderId,
    razorpayPaymentId,
    payloadCreatedAt,
}) => {
    try {
        return await RazorpayWebhookEvent.create({
            eventId,
            eventType,
            status,
            tenantId: purchase?.tenantId,
            purchaseId: purchase?._id,
            razorpayOrderId,
            razorpayPaymentId,
            payloadCreatedAt,
            processedAt: new Date(),
        });
    } catch (error) {
        if (error?.code === 11000) {
            return await RazorpayWebhookEvent.findOne({
                eventId,
            });
        }

        throw error;
    }
};

const handleRazorpayWebhook = async (req, res) => {
    const webhookSecret =
        process.env.RAZORPAY_WEBHOOK_SECRET || "";

    if (!webhookSecret) {
        return res.status(503).json({
            success: false,
            message: "Payment webhook is not configured",
        });
    }

    if (!Buffer.isBuffer(req.body)) {
        return res.status(415).json({
            success: false,
            message: "Raw JSON webhook body is required",
        });
    }

    const webhookSignature =
        req.get("x-razorpay-signature") || "";

    if (!isNonEmptyString(webhookSignature)) {
        return res.status(401).json({
            success: false,
            message: "Webhook signature is required",
        });
    }

    const signatureIsValid =
        verifyRazorpayWebhookSignature({
            rawBody: req.body,
            signature: webhookSignature,
            secret: webhookSecret,
        });

    if (!signatureIsValid) {
        return res.status(401).json({
            success: false,
            message: "Invalid webhook signature",
        });
    }

    let payload;

    try {
        payload = parseRazorpayWebhookPayload(
            req.body
        );
    } catch {
        return res.status(400).json({
            success: false,
            message: "Invalid webhook payload",
        });
    }

    const eventId =
        (req.get("x-razorpay-event-id") || "").trim();

    if (!eventId) {
        return res.status(400).json({
            success: false,
            message: "Webhook event ID is required",
        });
    }

    const eventType =
        typeof payload.event === "string"
            ? payload.event.trim()
            : "";

    if (!eventType) {
        return res.status(400).json({
            success: false,
            message: "Webhook event type is required",
        });
    }

    try {
        const existingEvent =
            await RazorpayWebhookEvent.findOne({
                eventId,
            }).lean();

        if (existingEvent) {
            return res.status(200).json({
                success: true,
                duplicate: true,
            });
        }

        if (eventType !== "payment.captured") {
            await recordWebhookEvent({
                eventId,
                eventType,
                status: "ignored",
                payloadCreatedAt:
                    getPayloadCreatedAt(payload),
            });

            return res.status(200).json({
                success: true,
                ignored: true,
            });
        }

        const payment =
            payload?.payload?.payment?.entity;

        const razorpayPaymentId =
            typeof payment?.id === "string"
                ? payment.id.trim()
                : "";

        const razorpayOrderId =
            typeof payment?.order_id === "string"
                ? payment.order_id.trim()
                : "";

        const paymentStatus =
            typeof payment?.status === "string"
                ? payment.status.trim()
                : "";

        const paymentCurrency =
            typeof payment?.currency === "string"
                ? payment.currency.trim().toUpperCase()
                : "";

        const paymentAmount =
            Number(payment?.amount);

        if (
            payment?.entity !== "payment" ||
            !razorpayPaymentId ||
            !razorpayOrderId ||
            paymentStatus !== "captured" ||
            payment?.captured !== true ||
            !Number.isInteger(paymentAmount) ||
            paymentAmount < 0 ||
            !paymentCurrency
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Captured payment payload is incomplete",
            });
        }

        const matchingPurchases =
            await Purchase.find({
                provider: "razorpay",
                razorpayOrderId,
            }).limit(2);

        if (matchingPurchases.length === 0) {
            return res.status(404).json({
                success: false,
                message:
                    "Matching payment purchase was not found",
            });
        }

        if (matchingPurchases.length > 1) {
            logRuntimeError(
                "Ambiguous Razorpay webhook purchase lookup:",
                new Error(
                    "Multiple purchases share one Razorpay order ID"
                )
            );

            return res.status(409).json({
                success: false,
                message:
                    "Payment purchase lookup is ambiguous",
            });
        }

        const purchase = matchingPurchases[0];

        if (
            Number(purchase.amountInPaise) !==
            paymentAmount
        ) {
            return res.status(409).json({
                success: false,
                message: "Webhook payment amount mismatch",
            });
        }

        if (
            String(purchase.currency || "")
                .trim()
                .toUpperCase() !== paymentCurrency
        ) {
            return res.status(409).json({
                success: false,
                message:
                    "Webhook payment currency mismatch",
            });
        }

        if (
            purchase.status === "paid" &&
            purchase.razorpayPaymentId &&
            purchase.razorpayPaymentId !==
                razorpayPaymentId
        ) {
            return res.status(409).json({
                success: false,
                message:
                    "Purchase is linked to another payment",
            });
        }

        const payloadCreatedAt =
            getPayloadCreatedAt(payload);

        const fulfillmentResult =
            await fulfillPaymentPackagePurchase({
                purchase,
                razorpayPaymentId,
                paidAt: payloadCreatedAt || new Date(),
            });

        await createPendingReferralRewardForPaidPurchase({
            purchase: fulfillmentResult.purchase,
        });

        await recordWebhookEvent({
            eventId,
            eventType,
            status: "processed",
            purchase: fulfillmentResult.purchase,
            razorpayOrderId,
            razorpayPaymentId,
            payloadCreatedAt,
        });

        return res.status(200).json({
            success: true,
            processed: true,
            alreadyPaid:
                fulfillmentResult.alreadyPaid,
        });
    } catch (error) {
        logRuntimeError(
            "Razorpay webhook processing error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to process payment webhook",
        });
    }
};

module.exports = {
    handleRazorpayWebhook,
};