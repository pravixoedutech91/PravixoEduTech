"use strict";

// B5-B2-B1: opt-in published experience policy. This module does not
// interpret a legacy test with no policy as practice or exam simulation.
const EXPERIENCE_POLICY_VERSION = 1;
const EXPERIENCE_MODES = Object.freeze(["exam_simulation", "practice"]);
const ALLOWED_POLICY_KEYS = Object.freeze(["policyVersion", "allowedModes"]);

const invalid = (message) => ({ valid: false, message });

const validateExperiencePolicy = (input) => {
  if (input === undefined) {
    return { valid: true, policy: undefined };
  }

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return invalid("Experience policy must be an object when provided");
  }

  const value = typeof input.toObject === "function"
    ? input.toObject({ transform: false })
    : input;

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return invalid("Experience policy must be an object when provided");
  }

  if (
    Object.keys(value).some((key) => !ALLOWED_POLICY_KEYS.includes(key)) ||
    Object.keys(value).length !== ALLOWED_POLICY_KEYS.length
  ) {
    return invalid("Experience policy must contain only policyVersion and allowedModes");
  }

  if (value.policyVersion !== EXPERIENCE_POLICY_VERSION) {
    return invalid("Unsupported experience policy version");
  }

  if (
    !Array.isArray(value.allowedModes) ||
    value.allowedModes.length < 1 ||
    value.allowedModes.length > EXPERIENCE_MODES.length ||
    value.allowedModes.some((mode) => !EXPERIENCE_MODES.includes(mode)) ||
    new Set(value.allowedModes).size !== value.allowedModes.length
  ) {
    return invalid("Experience policy requires one or two unique supported modes");
  }

  // A fresh snapshot prevents accidental mutation of a draft from
  // affecting any already-created version's policy object.
  return {
    valid: true,
    policy: {
      policyVersion: EXPERIENCE_POLICY_VERSION,
      allowedModes: [...value.allowedModes],
    },
  };
};

const createExperiencePolicySchema = (mongoose) => new mongoose.Schema(
  {
    policyVersion: {
      type: Number,
      required: true,
      validate: {
        validator: (value) => value === EXPERIENCE_POLICY_VERSION,
        message: "Unsupported experience policy version",
      },
    },
    allowedModes: {
      type: [String],
      default: undefined,
      required: true,
      validate: {
        validator: (value) => Array.isArray(value) &&
          value.length >= 1 &&
          value.length <= EXPERIENCE_MODES.length &&
          value.every((mode) => EXPERIENCE_MODES.includes(mode)) &&
          new Set(value).size === value.length,
        message: "Experience policy requires one or two unique supported modes",
      },
    },
  },
  { _id: false, strict: "throw" }
);

module.exports = {
  EXPERIENCE_POLICY_VERSION,
  EXPERIENCE_MODES,
  validateExperiencePolicy,
  createExperiencePolicySchema,
};
