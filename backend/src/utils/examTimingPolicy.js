const TIMING_MODES = Object.freeze({
  GLOBAL: "global",
  SECTIONAL: "sectional",
});

const TIMING_POLICY_VERSIONS = Object.freeze({
  LEGACY: 0,
  V1: 1,
});

const CURRENT_TIMING_POLICY_VERSION =
  TIMING_POLICY_VERSIONS.V1;

const SUPPORTED_TIMING_MODES = new Set(Object.values(TIMING_MODES));

const resolveTimingMode = (value) => {
  if (value === undefined) {
    return TIMING_MODES.GLOBAL;
  }

  return String(value).trim().toLowerCase();
};

const buildExamTimingPolicySnapshot = (examPattern = {}) => {
  const timingMode =
    resolveTimingMode(examPattern?.timingMode);

  if (!SUPPORTED_TIMING_MODES.has(timingMode)) {
    throw new Error(
      `Unsupported timingMode for published snapshot: ${timingMode}`
    );
  }

  return {
    timingMode,
    timingPolicyVersion:
      CURRENT_TIMING_POLICY_VERSION,
  };
};

const getSectionDurationTotal = (sections = []) => {
  return sections.reduce(
    (total, section) => total + Number(section?.durationMinutes || 0),
    0
  );
};

const validateExamTimingPolicy = ({
  timingMode,
  totalDurationMinutes,
  sections,
} = {}) => {
  const resolvedTimingMode = resolveTimingMode(timingMode);

  if (!SUPPORTED_TIMING_MODES.has(resolvedTimingMode)) {
    return {
      valid: false,
      path: "timingMode",
      timingMode: resolvedTimingMode,
      message: "timingMode must be one of: global, sectional",
    };
  }

  const totalDuration = Number(totalDurationMinutes);

  if (!Number.isFinite(totalDuration) || totalDuration <= 0) {
    return {
      valid: false,
      path: "totalDurationMinutes",
      timingMode: resolvedTimingMode,
      message: "Total duration must be a positive number",
    };
  }

  if (!Array.isArray(sections) || sections.length === 0) {
    return {
      valid: false,
      path: "sections",
      timingMode: resolvedTimingMode,
      message: "At least one section is required",
    };
  }

  const sectionDurations = sections.map((section) =>
    Number(section?.durationMinutes)
  );

  if (
    sectionDurations.some(
      (duration) => !Number.isFinite(duration) || duration < 0
    )
  ) {
    return {
      valid: false,
      path: "sections",
      timingMode: resolvedTimingMode,
      message: "Section durations must be zero or positive numbers",
    };
  }

  if (resolvedTimingMode === TIMING_MODES.GLOBAL) {
    return {
      valid: true,
      timingMode: TIMING_MODES.GLOBAL,
      sectionDurationTotal: getSectionDurationTotal(sections),
    };
  }

  if (sectionDurations.some((duration) => duration <= 0)) {
    return {
      valid: false,
      path: "sections",
      timingMode: resolvedTimingMode,
      message:
        "Every section must have a positive duration when timingMode is sectional",
    };
  }

  const sectionDurationTotal =
    getSectionDurationTotal(sections);

  if (
    Math.abs(sectionDurationTotal - totalDuration) >
    1e-9
  ) {
    return {
      valid: false,
      path: "sections",
      timingMode: resolvedTimingMode,
      message:
        "Total duration must equal the sum of all section durations when timingMode is sectional",
    };
  }

  return {
    valid: true,
    timingMode: TIMING_MODES.SECTIONAL,
    sectionDurationTotal,
  };
};

module.exports = {
  TIMING_MODES,
  TIMING_POLICY_VERSIONS,
  CURRENT_TIMING_POLICY_VERSION,
  resolveTimingMode,
  buildExamTimingPolicySnapshot,
  getSectionDurationTotal,
  validateExamTimingPolicy,
};