const {
  TIMING_MODES,
  TIMING_POLICY_VERSIONS,
  CURRENT_TIMING_POLICY_VERSION,
  resolveTimingMode,
} = require("./examTimingPolicy");

const MILLISECONDS_PER_SECOND = 1000;
const MILLISECONDS_PER_MINUTE = 60 * MILLISECONDS_PER_SECOND;

const asValidDate = (value, label) => {
  const date = value instanceof Date
    ? new Date(value.getTime())
    : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`${label} must be a valid date`);
  }

  return date;
};

const normalizePolicyVersion = (value) => {
  if (value === undefined || value === null) {
    return TIMING_POLICY_VERSIONS.LEGACY;
  }

  const version = Number(value);

  if (
    !Number.isInteger(version) ||
    version < TIMING_POLICY_VERSIONS.LEGACY
  ) {
    throw new Error(
      "Attempt timing policy version must be a non-negative integer"
    );
  }

  return version;
};

const assertSupportedAttemptTimingContract = ({
  mode,
  policyVersion,
}) => {
  if (mode === TIMING_MODES.GLOBAL) {
    if (
      policyVersion !== TIMING_POLICY_VERSIONS.LEGACY &&
      policyVersion !== CURRENT_TIMING_POLICY_VERSION
    ) {
      throw new Error(
        `Unsupported global attempt timing policy version: ${policyVersion}`
      );
    }

    return;
  }

  if (mode === TIMING_MODES.SECTIONAL) {
    if (policyVersion !== CURRENT_TIMING_POLICY_VERSION) {
      throw new Error(
        `Unsupported sectional attempt timing policy version: ${policyVersion}`
      );
    }

    return;
  }

  throw new Error(
    `Unsupported attempt timing mode: ${mode}`
  );
};

const getSortedSectionDefinitions = (sections) => {
  if (!Array.isArray(sections) || sections.length === 0) {
    throw new Error(
      "Sectional timing requires at least one published section"
    );
  }

  const normalized = sections.map(
    (section, index) => {
      const sectionSlug =
        String(section?.sectionSlug || "").trim();

      const order =
        Number(section?.order);

      const durationMinutes =
        Number(section?.durationMinutes);

      if (!sectionSlug) {
        throw new Error(
          `Sectional timing section ${index + 1} must have sectionSlug`
        );
      }

      if (!Number.isInteger(order) || order < 1) {
        throw new Error(
          `Sectional timing section ${sectionSlug} must have a positive integer order`
        );
      }

      if (
        !Number.isFinite(durationMinutes) ||
        durationMinutes <= 0
      ) {
        throw new Error(
          `Sectional timing section ${sectionSlug} must have a positive duration`
        );
      }

      return {
        sectionSlug,
        order,
        durationMinutes,
      };
    }
  );

  const slugSet =
    new Set(
      normalized.map(
        (section) => section.sectionSlug
      )
    );

  if (slugSet.size !== normalized.length) {
    throw new Error(
      "Sectional timing sectionSlug values must be unique"
    );
  }

  const orderSet =
    new Set(
      normalized.map(
        (section) => section.order
      )
    );

  if (orderSet.size !== normalized.length) {
    throw new Error(
      "Sectional timing section order values must be unique"
    );
  }

  return [...normalized].sort(
    (a, b) => a.order - b.order
  );
};

const buildAttemptTimingState = ({
  mockTestVersion,
  startedAt,
} = {}) => {
  if (!mockTestVersion) {
    throw new Error(
      "mockTestVersion is required to build attempt timing state"
    );
  }

  const snapshot =
    mockTestVersion.examPatternSnapshot || {};

  const mode =
    resolveTimingMode(snapshot.timingMode);

  const policyVersion =
    normalizePolicyVersion(
      snapshot.timingPolicyVersion
    );

  assertSupportedAttemptTimingContract({
    mode,
    policyVersion,
  });

  if (mode === TIMING_MODES.GLOBAL) {
    return {
      mode: TIMING_MODES.GLOBAL,
      policyVersion,
      sectionWindows: [],
    };
  }

  const attemptStartedAt =
    asValidDate(
      startedAt,
      "Attempt startedAt"
    );

  const sections =
    getSortedSectionDefinitions(
      mockTestVersion.sections
    );

  const declaredTotalDurationMinutes =
    Number(
      snapshot.totalDurationMinutes
    );

  if (
    !Number.isFinite(
      declaredTotalDurationMinutes
    ) ||
    declaredTotalDurationMinutes <= 0
  ) {
    throw new Error(
      "Sectional timing requires a positive published total duration"
    );
  }

  const sectionDurationTotal =
    sections.reduce(
      (total, section) =>
        total + section.durationMinutes,
      0
    );

  if (
    Math.abs(
      sectionDurationTotal -
        declaredTotalDurationMinutes
    ) > 1e-9
  ) {
    throw new Error(
      "Published sectional duration total does not match section durations"
    );
  }

  let cursorMilliseconds =
    attemptStartedAt.getTime();

  const sectionWindows =
    sections.map((section) => {
      const startsAt =
        new Date(cursorMilliseconds);

      const expiresAt =
        new Date(
          cursorMilliseconds +
            section.durationMinutes *
              MILLISECONDS_PER_MINUTE
        );

      cursorMilliseconds =
        expiresAt.getTime();

      return {
        sectionSlug:
          section.sectionSlug,
        order:
          section.order,
        startsAt,
        expiresAt,
      };
    });

  return {
    mode: TIMING_MODES.SECTIONAL,
    policyVersion,
    sectionWindows,
  };
};

const calculateRemainingSeconds = (
  expiresAt,
  now
) => {
  if (!expiresAt) {
    return null;
  }

  return Math.max(
    0,
    Math.ceil(
      (
        expiresAt.getTime() -
        now.getTime()
      ) /
        MILLISECONDS_PER_SECOND
    )
  );
};

const normalizeStoredSectionWindows = (
  sectionWindows
) => {
  if (
    !Array.isArray(sectionWindows) ||
    sectionWindows.length === 0
  ) {
    throw new Error(
      "Sectional attempt timing state requires section windows"
    );
  }

  const normalized =
    sectionWindows.map(
      (window, index) => {
        const sectionSlug =
          String(
            window?.sectionSlug || ""
          ).trim();

        const order =
          Number(window?.order);

        const startsAt =
          asValidDate(
            window?.startsAt,
            `Section window ${index + 1} startsAt`
          );

        const expiresAt =
          asValidDate(
            window?.expiresAt,
            `Section window ${index + 1} expiresAt`
          );

        if (!sectionSlug) {
          throw new Error(
            `Section window ${index + 1} must have sectionSlug`
          );
        }

        if (
          !Number.isInteger(order) ||
          order < 1
        ) {
          throw new Error(
            `Section window ${sectionSlug} must have a positive integer order`
          );
        }

        if (
          expiresAt.getTime() <=
          startsAt.getTime()
        ) {
          throw new Error(
            `Section window ${sectionSlug} must expire after it starts`
          );
        }

        return {
          sectionSlug,
          order,
          startsAt,
          expiresAt,
        };
      }
    );

  const slugSet =
    new Set(
      normalized.map(
        (window) =>
          window.sectionSlug
      )
    );

  if (slugSet.size !== normalized.length) {
    throw new Error(
      "Stored section timing window slugs must be unique"
    );
  }

  const orderSet =
    new Set(
      normalized.map(
        (window) => window.order
      )
    );

  if (orderSet.size !== normalized.length) {
    throw new Error(
      "Stored section timing window orders must be unique"
    );
  }

  const sorted =
    [...normalized].sort(
      (a, b) => a.order - b.order
    );

  for (
    let index = 1;
    index < sorted.length;
    index += 1
  ) {
    if (
      sorted[index].startsAt.getTime() !==
      sorted[index - 1].expiresAt.getTime()
    ) {
      throw new Error(
        "Stored sectional timing windows must be contiguous"
      );
    }
  }

  return sorted;
};

const resolveAttemptTimingState = ({
  attempt,
  now,
} = {}) => {
  if (!attempt) {
    throw new Error(
      "attempt is required to resolve timing state"
    );
  }

  const serverNow =
    asValidDate(
      now,
      "Server now"
    );

  const storedTimingState =
    attempt.timingState;

  if (!storedTimingState) {
    const overallExpiresAt =
      attempt.expiresAt
        ? asValidDate(
            attempt.expiresAt,
            "Attempt expiresAt"
          )
        : null;

    return {
      mode: TIMING_MODES.GLOBAL,
      policyVersion:
        TIMING_POLICY_VERSIONS.LEGACY,
      attemptExpired:
        Boolean(
          overallExpiresAt &&
            overallExpiresAt.getTime() <=
              serverNow.getTime()
        ),
      overallExpiresAt,
      overallRemainingSeconds:
        calculateRemainingSeconds(
          overallExpiresAt,
          serverNow
        ),
      activeSection: null,
      expiredSectionSlugs: [],
      lockedSectionSlugs: [],
      sectionWindows: [],
    };
  }

  const mode =
    resolveTimingMode(
      storedTimingState.mode
    );

  const policyVersion =
    normalizePolicyVersion(
      storedTimingState.policyVersion
    );

  assertSupportedAttemptTimingContract({
    mode,
    policyVersion,
  });

  const overallExpiresAt =
    attempt.expiresAt
      ? asValidDate(
          attempt.expiresAt,
          "Attempt expiresAt"
        )
      : null;

  const overallExpired =
    Boolean(
      overallExpiresAt &&
        overallExpiresAt.getTime() <=
          serverNow.getTime()
    );

  if (mode === TIMING_MODES.GLOBAL) {
    return {
      mode,
      policyVersion,
      attemptExpired:
        overallExpired,
      overallExpiresAt,
      overallRemainingSeconds:
        calculateRemainingSeconds(
          overallExpiresAt,
          serverNow
        ),
      activeSection: null,
      expiredSectionSlugs: [],
      lockedSectionSlugs: [],
      sectionWindows: [],
    };
  }

  const sectionWindows =
    normalizeStoredSectionWindows(
      storedTimingState.sectionWindows
    );

  const expiredSectionSlugs = [];
  const lockedSectionSlugs = [];

  let activeSection = null;

  for (
    let index = 0;
    index < sectionWindows.length;
    index += 1
  ) {
    const window =
      sectionWindows[index];

    const startsMilliseconds =
      window.startsAt.getTime();

    const expiresMilliseconds =
      window.expiresAt.getTime();

    const nowMilliseconds =
      serverNow.getTime();

    if (
      nowMilliseconds >=
      expiresMilliseconds
    ) {
      expiredSectionSlugs.push(
        window.sectionSlug
      );

      continue;
    }

    if (
      nowMilliseconds <
      startsMilliseconds
    ) {
      lockedSectionSlugs.push(
        window.sectionSlug
      );

      continue;
    }

    activeSection = {
      sectionSlug:
        window.sectionSlug,
      order:
        window.order,
      startsAt:
        window.startsAt,
      expiresAt:
        window.expiresAt,
      remainingSeconds:
        calculateRemainingSeconds(
          window.expiresAt,
          serverNow
        ),
    };
  }

  const finalSectionExpiresAt =
    sectionWindows[
      sectionWindows.length - 1
    ].expiresAt;

  const scheduleExpired =
    finalSectionExpiresAt.getTime() <=
    serverNow.getTime();

  return {
    mode,
    policyVersion,
    attemptExpired:
      overallExpired ||
      scheduleExpired,
    overallExpiresAt,
    overallRemainingSeconds:
      calculateRemainingSeconds(
        overallExpiresAt,
        serverNow
      ),
    activeSection,
    expiredSectionSlugs,
    lockedSectionSlugs,
    sectionWindows,
  };
};

module.exports = {
  buildAttemptTimingState,
  resolveAttemptTimingState,
};