"use strict";
const mongoose = require("mongoose");
const crypto = require("crypto");

// The _id unique index already exists on every MongoDB collection.
// A digest avoids delimiter collisions and exposes no raw student identifier in _id.
const makeKey = ({ tenantId, studentId, mockTestId }) => {
    const tuple = [tenantId, studentId, mockTestId].map((value) => String(value));
    return crypto.createHash("sha256").update(JSON.stringify(tuple)).digest("hex");
};

const schema = new mongoose.Schema({
    _id: { type: String, required: true },
    tenantId: { type: mongoose.Schema.Types.Mixed, required: true },
    studentId: { type: mongoose.Schema.Types.Mixed, required: true },
    mockTestId: { type: mongoose.Schema.Types.Mixed, required: true },
    revision: { type: Number, required: true, default: 0 },
}, { timestamps: true });

const Model = mongoose.models.TestAttemptAdmissionGuard ||
    mongoose.model("TestAttemptAdmissionGuard", schema);
Model.makeKey = makeKey;
module.exports = Model;
