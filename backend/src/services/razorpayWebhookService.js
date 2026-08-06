const crypto = require("crypto");

const isNonEmptyString = (value) => {
    return typeof value === "string" && value.trim().length > 0;
};

const safeCompareStrings = (leftValue, rightValue) => {
    if (
        !isNonEmptyString(leftValue) ||
        !isNonEmptyString(rightValue)
    ) {
        return false;
    }

    const leftBuffer = Buffer.from(leftValue, "utf8");
    const rightBuffer = Buffer.from(rightValue, "utf8");

    if (leftBuffer.length !== rightBuffer.length) {
        return false;
    }

    return crypto.timingSafeEqual(
        leftBuffer,
        rightBuffer
    );
};

const verifyRazorpayWebhookSignature = ({
    rawBody,
    signature,
    secret,
}) => {
    if (
        !Buffer.isBuffer(rawBody) ||
        !isNonEmptyString(signature) ||
        typeof secret !== "string" ||
        secret.length === 0
    ) {
        return false;
    }

    const generatedSignature = crypto
        .createHmac("sha256", secret)
        .update(rawBody)
        .digest("hex");

    return safeCompareStrings(
        generatedSignature,
        signature.trim()
    );
};

const parseRazorpayWebhookPayload = (rawBody) => {
    if (!Buffer.isBuffer(rawBody)) {
        throw new Error(
            "Razorpay webhook body must be a raw buffer"
        );
    }

    const parsedPayload = JSON.parse(
        rawBody.toString("utf8")
    );

    if (
        !parsedPayload ||
        typeof parsedPayload !== "object" ||
        Array.isArray(parsedPayload)
    ) {
        throw new Error(
            "Razorpay webhook payload must be an object"
        );
    }

    return parsedPayload;
};

const getPayloadCreatedAt = (payload) => {
    const createdAtInSeconds =
        Number(payload?.created_at);

    if (
        !Number.isFinite(createdAtInSeconds) ||
        createdAtInSeconds <= 0
    ) {
        return undefined;
    }

    const date = new Date(createdAtInSeconds * 1000);

    if (Number.isNaN(date.getTime())) {
        return undefined;
    }

    return date;
};

module.exports = {
    getPayloadCreatedAt,
    parseRazorpayWebhookPayload,
    verifyRazorpayWebhookSignature,
};