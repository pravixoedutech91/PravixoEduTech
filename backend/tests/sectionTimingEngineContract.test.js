const test = require("node:test");
const assert = require("node:assert/strict");

const ExamPattern = require("../src/models/ExamPattern");
const {
  TIMING_MODES,
  resolveTimingMode,
  validateExamTimingPolicy,
} = require("../src/utils/examTimingPolicy");

const {
  createExamPattern,
  updateExamPattern,
} = require("../src/controllers/examPatternController");

const makeSection = ({
  name = "Section",
  durationMinutes = 0,
  order = 1,
} = {}) => ({
  name,
  sectionType: "mcq",
  durationMinutes,
  questionCount: 10,
  marksPerQuestion: 1,
  negativeMarks: 0,
  order,
});

const makeResponse = () => ({
  statusCode: 200,
  body: null,

  status(code) {
    this.statusCode = code;
    return this;
  },

  json(body) {
    this.body = body;
    return this;
  },
});

test("SECTION-TIMER-B1 timing policy contract", async (t) => {
  await t.test(
    "missing timingMode resolves to global for backward compatibility",
    () => {
      assert.equal(
        resolveTimingMode(undefined),
        TIMING_MODES.GLOBAL
      );
    }
  );

  await t.test(
    "global timing does not require section durations to sum to total duration",
    () => {
      const result = validateExamTimingPolicy({
        totalDurationMinutes: 90,
        sections: [
          makeSection({
            name: "General Awareness",
            durationMinutes: 0,
            order: 1,
          }),
          makeSection({
            name: "Mathematics",
            durationMinutes: 0,
            order: 2,
          }),
          makeSection({
            name: "Reasoning",
            durationMinutes: 0,
            order: 3,
          }),
        ],
      });

      assert.equal(result.valid, true);
      assert.equal(
        result.timingMode,
        TIMING_MODES.GLOBAL
      );
    }
  );

  await t.test(
    "global timing accepts non-negative informational section durations without treating them as timers",
    () => {
      const result = validateExamTimingPolicy({
        timingMode: "global",
        totalDurationMinutes: 90,
        sections: [
          makeSection({
            durationMinutes: 20,
            order: 1,
          }),
          makeSection({
            durationMinutes: 30,
            order: 2,
          }),
        ],
      });

      assert.equal(result.valid, true);
      assert.equal(result.sectionDurationTotal, 50);
    }
  );

  await t.test(
    "sectional timing requires positive duration for every section",
    () => {
      const result = validateExamTimingPolicy({
        timingMode: "sectional",
        totalDurationMinutes: 30,
        sections: [
          makeSection({
            durationMinutes: 15,
            order: 1,
          }),
          makeSection({
            durationMinutes: 0,
            order: 2,
          }),
        ],
      });

      assert.equal(result.valid, false);
      assert.match(
        result.message,
        /positive duration/i
      );
    }
  );

  await t.test(
    "sectional timing requires section duration sum to equal total duration",
    () => {
      const result = validateExamTimingPolicy({
        timingMode: "sectional",
        totalDurationMinutes: 60,
        sections: [
          makeSection({
            durationMinutes: 15,
            order: 1,
          }),
          makeSection({
            durationMinutes: 15,
            order: 2,
          }),
          makeSection({
            durationMinutes: 15,
            order: 3,
          }),
        ],
      });

      assert.equal(result.valid, false);
      assert.match(
        result.message,
        /sum of all section durations/i
      );
    }
  );

  await t.test(
    "valid sectional timing passes",
    () => {
      const result = validateExamTimingPolicy({
        timingMode: "sectional",
        totalDurationMinutes: 60,
        sections: [
          makeSection({
            durationMinutes: 15,
            order: 1,
          }),
          makeSection({
            durationMinutes: 15,
            order: 2,
          }),
          makeSection({
            durationMinutes: 15,
            order: 3,
          }),
          makeSection({
            durationMinutes: 15,
            order: 4,
          }),
        ],
      });

      assert.equal(result.valid, true);
      assert.equal(
        result.timingMode,
        TIMING_MODES.SECTIONAL
      );
      assert.equal(result.sectionDurationTotal, 60);
    }
  );

  await t.test(
    "unsupported timing mode fails closed",
    () => {
      const result = validateExamTimingPolicy({
        timingMode: "hybrid",
        totalDurationMinutes: 60,
        sections: [
          makeSection({
            durationMinutes: 60,
          }),
        ],
      });

      assert.equal(result.valid, false);
      assert.match(
        result.message,
        /global, sectional/i
      );
    }
  );

  await t.test(
    "ExamPattern schema defaults legacy/missing timing mode to global",
    async () => {
      const pattern = new ExamPattern({
        name: "Legacy Global Pattern",
        slug: "legacy-global-pattern",
        totalDurationMinutes: 90,
        sections: [
          makeSection({
            durationMinutes: 0,
          }),
        ],
      });

      await pattern.validate();

      assert.equal(
        pattern.timingMode,
        TIMING_MODES.GLOBAL
      );
    }
  );

  await t.test(
    "ExamPattern model permits global duration mismatch",
    async () => {
      const pattern = new ExamPattern({
        name: "Global Pattern",
        slug: "global-pattern",
        timingMode: "global",
        totalDurationMinutes: 90,
        sections: [
          makeSection({
            durationMinutes: 20,
            order: 1,
          }),
          makeSection({
            durationMinutes: 20,
            order: 2,
          }),
        ],
      });

      await pattern.validate();

      assert.equal(pattern.timingMode, "global");
    }
  );

  await t.test(
    "ExamPattern model rejects invalid sectional duration total",
    async () => {
      const pattern = new ExamPattern({
        name: "Invalid Sectional Pattern",
        slug: "invalid-sectional-pattern",
        timingMode: "sectional",
        totalDurationMinutes: 60,
        sections: [
          makeSection({
            durationMinutes: 15,
            order: 1,
          }),
          makeSection({
            durationMinutes: 15,
            order: 2,
          }),
        ],
      });

      await assert.rejects(
        pattern.validate(),
        /sum of all section durations/i
      );
    }
  );

  await t.test(
    "create controller stores explicit global mode when legacy client omits timingMode",
    async (t) => {
      const originalCreate = ExamPattern.create;

      let capturedCreateData = null;

      ExamPattern.create = async (data) => {
        capturedCreateData = data;

        return {
          ...data,
          _id: "created-pattern",
        };
      };

      t.after(() => {
        ExamPattern.create = originalCreate;
      });

      const req = {
        user: {
          tenantId: "pravixoedutech",
          _id: "admin-user",
        },

        body: {
          name: "Global Controller Pattern",
          slug: "global-controller-pattern",
          totalDurationMinutes: 90,
          sections: [
            makeSection({
              durationMinutes: 0,
            }),
          ],
        },
      };

      const res = makeResponse();

      await createExamPattern(req, res);

      assert.equal(res.statusCode, 201);
      assert.equal(
        capturedCreateData.timingMode,
        "global"
      );
    }
  );

  await t.test(
    "create controller rejects invalid sectional timing before database create",
    async (t) => {
      const originalCreate = ExamPattern.create;

      let createCalled = false;

      ExamPattern.create = async () => {
        createCalled = true;
        throw new Error("create should not run");
      };

      t.after(() => {
        ExamPattern.create = originalCreate;
      });

      const req = {
        user: {
          tenantId: "pravixoedutech",
          _id: "admin-user",
        },

        body: {
          name: "Bad Sectional Pattern",
          slug: "bad-sectional-pattern",
          timingMode: "sectional",
          totalDurationMinutes: 60,
          sections: [
            makeSection({
              durationMinutes: 15,
              order: 1,
            }),
            makeSection({
              durationMinutes: 15,
              order: 2,
            }),
          ],
        },
      };

      const res = makeResponse();

      await createExamPattern(req, res);

      assert.equal(res.statusCode, 400);
      assert.equal(createCalled, false);
      assert.match(
        res.body.message,
        /sum of all section durations/i
      );
    }
  );

  await t.test(
    "partial update validates effective sectional pattern rather than only submitted fields",
    async (t) => {
      const originalFindOne =
        ExamPattern.findOne;

      const originalFindOneAndUpdate =
        ExamPattern.findOneAndUpdate;

      let updateCalled = false;

      ExamPattern.findOne = async () => ({
        timingMode: "sectional",
        totalDurationMinutes: 60,
        sections: [
          makeSection({
            durationMinutes: 15,
            order: 1,
          }),
          makeSection({
            durationMinutes: 15,
            order: 2,
          }),
          makeSection({
            durationMinutes: 15,
            order: 3,
          }),
          makeSection({
            durationMinutes: 15,
            order: 4,
          }),
        ],
      });

      ExamPattern.findOneAndUpdate =
        async () => {
          updateCalled = true;
          throw new Error(
            "update should not run"
          );
        };

      t.after(() => {
        ExamPattern.findOne =
          originalFindOne;

        ExamPattern.findOneAndUpdate =
          originalFindOneAndUpdate;
      });

      const req = {
        user: {
          _id: "admin-user",
        },

        params: {
          id: "pattern-id",
        },

        body: {
          totalDurationMinutes: 65,
        },
      };

      const res = makeResponse();

      await updateExamPattern(req, res);

      assert.equal(res.statusCode, 400);
      assert.equal(updateCalled, false);
      assert.match(
        res.body.message,
        /sum of all section durations/i
      );
    }
  );

  await t.test(
    "switching a global zero-duration pattern to sectional fails safely",
    async (t) => {
      const originalFindOne =
        ExamPattern.findOne;

      const originalFindOneAndUpdate =
        ExamPattern.findOneAndUpdate;

      let updateCalled = false;

      ExamPattern.findOne = async () => ({
        timingMode: "global",
        totalDurationMinutes: 90,
        sections: [
          makeSection({
            durationMinutes: 0,
            order: 1,
          }),
          makeSection({
            durationMinutes: 0,
            order: 2,
          }),
        ],
      });

      ExamPattern.findOneAndUpdate =
        async () => {
          updateCalled = true;
          throw new Error(
            "update should not run"
          );
        };

      t.after(() => {
        ExamPattern.findOne =
          originalFindOne;

        ExamPattern.findOneAndUpdate =
          originalFindOneAndUpdate;
      });

      const req = {
        user: {
          _id: "admin-user",
        },

        params: {
          id: "pattern-id",
        },

        body: {
          timingMode: "sectional",
        },
      };

      const res = makeResponse();

      await updateExamPattern(req, res);

      assert.equal(res.statusCode, 400);
      assert.equal(updateCalled, false);
      assert.match(
        res.body.message,
        /positive duration/i
      );
    }
  );

  await t.test(
    "partial global update does not restore obsolete section-sum requirement",
    async (t) => {
      const originalFindOne =
        ExamPattern.findOne;

      const originalFindOneAndUpdate =
        ExamPattern.findOneAndUpdate;

      let capturedUpdateData = null;

      ExamPattern.findOne = async () => ({
        timingMode: undefined,
        totalDurationMinutes: 90,
        sections: [
          makeSection({
            durationMinutes: 0,
            order: 1,
          }),
          makeSection({
            durationMinutes: 0,
            order: 2,
          }),
          makeSection({
            durationMinutes: 0,
            order: 3,
          }),
        ],
      });

      ExamPattern.findOneAndUpdate =
        async (filter, data) => {
          capturedUpdateData = data;

          return {
            ...data,
            _id: "pattern-id",
          };
        };

      t.after(() => {
        ExamPattern.findOne =
          originalFindOne;

        ExamPattern.findOneAndUpdate =
          originalFindOneAndUpdate;
      });

      const req = {
        user: {
          _id: "admin-user",
        },

        params: {
          id: "pattern-id",
        },

        body: {
          totalDurationMinutes: 100,
        },
      };

      const res = makeResponse();

      await updateExamPattern(req, res);

      assert.equal(res.statusCode, 200);
      assert.equal(
        capturedUpdateData.timingMode,
        "global"
      );
      assert.equal(
        capturedUpdateData.totalDurationMinutes,
        100
      );
    }
  );
});
const fsForTimingSnapshot = require("node:fs");
const pathForTimingSnapshot = require("node:path");

const MockTestVersionForTimingSnapshot =
  require("../src/models/MockTestVersion");

const {
  TIMING_POLICY_VERSIONS,
  CURRENT_TIMING_POLICY_VERSION,
  buildExamTimingPolicySnapshot,
} = require("../src/utils/examTimingPolicy");

test(
  "SECTION-TIMER-B2 published timing snapshot contract",
  async (t) => {
    await t.test(
      "timing policy versions preserve explicit legacy and current contracts",
      () => {
        assert.equal(
          TIMING_POLICY_VERSIONS.LEGACY,
          0
        );

        assert.equal(
          TIMING_POLICY_VERSIONS.V1,
          1
        );

        assert.equal(
          CURRENT_TIMING_POLICY_VERSION,
          1
        );
      }
    );

    await t.test(
      "legacy or missing exam timing mode publishes as global V1",
      () => {
        const snapshot =
          buildExamTimingPolicySnapshot({});

        assert.deepEqual(
          snapshot,
          {
            timingMode: "global",
            timingPolicyVersion: 1,
          }
        );
      }
    );

    await t.test(
      "sectional exam publishes as sectional V1",
      () => {
        const snapshot =
          buildExamTimingPolicySnapshot({
            timingMode: "sectional",
          });

        assert.deepEqual(
          snapshot,
          {
            timingMode: "sectional",
            timingPolicyVersion: 1,
          }
        );
      }
    );

    await t.test(
      "unsupported timing mode cannot be frozen into a published snapshot",
      () => {
        assert.throws(
          () =>
            buildExamTimingPolicySnapshot({
              timingMode: "hybrid",
            }),
          /Unsupported timingMode/
        );
      }
    );

    await t.test(
      "MockTestVersion snapshot schema preserves legacy defaults",
      () => {
        const snapshotPath =
          MockTestVersionForTimingSnapshot.schema.path(
            "examPatternSnapshot"
          );

        assert.ok(snapshotPath);
        assert.ok(snapshotPath.schema);

        const snapshotSchema =
          snapshotPath.schema;

        const timingModePath =
          snapshotSchema.path("timingMode");

        const timingPolicyVersionPath =
          snapshotSchema.path(
            "timingPolicyVersion"
          );

        assert.ok(timingModePath);
        assert.ok(timingPolicyVersionPath);

        assert.deepEqual(
          [...timingModePath.enumValues].sort(),
          ["global", "sectional"]
        );

        assert.equal(
          timingModePath.defaultValue,
          "global"
        );

        assert.equal(
          timingPolicyVersionPath.defaultValue,
          0
        );

        assert.equal(
          timingPolicyVersionPath.options.min,
          0
        );
      }
    );

    await t.test(
      "published snapshot builder is wired to timing policy snapshot helper",
      () => {
        const controllerPath =
          pathForTimingSnapshot.join(
            __dirname,
            "../src/controllers/mockTestController.js"
          );

        const source =
          fsForTimingSnapshot.readFileSync(
            controllerPath,
            "utf8"
          );

        assert.match(
          source,
          /const buildExamPatternSnapshot = \(examPattern\) => \{[\s\S]*?\.\.\.buildExamTimingPolicySnapshot\(examPattern\)[\s\S]*?totalDurationMinutes: examPattern\.totalDurationMinutes/
        );

        assert.match(
          source,
          /examPatternSnapshot:\s*buildExamPatternSnapshot\(\s*examPatternValidation\.examPattern\s*\)/
        );
      }
    );

    await t.test(
      "B2 does not place timing policy fields on section snapshots",
      () => {
        const controllerPath =
          pathForTimingSnapshot.join(
            __dirname,
            "../src/controllers/mockTestController.js"
          );

        const source =
          fsForTimingSnapshot.readFileSync(
            controllerPath,
            "utf8"
          );

        const sectionBuilderMatch =
          source.match(
            /const buildSectionSnapshots = \(mockTest, questionMap, questionGroupMap\) => \{[\s\S]*?^};/m
          );

        assert.ok(
          sectionBuilderMatch,
          "buildSectionSnapshots source must be discoverable"
        );

        assert.doesNotMatch(
          sectionBuilderMatch[0],
          /timingPolicyVersion/
        );
      }
    );
  }
);
const TestAttemptForTimingState =
  require("../src/models/TestAttempt");

const {
  buildAttemptTimingState,
  resolveAttemptTimingState,
} = require("../src/utils/attemptTimingPolicy");

test(
  "SECTION-TIMER-B3A permanent attempt timing contract",
  async (t) => {
    const baseStartedAt =
      new Date("2026-10-08T10:00:00.000Z");

    const makeSectionalVersion = () => ({
      examPatternSnapshot: {
        timingMode: "sectional",
        timingPolicyVersion: 1,
        totalDurationMinutes: 60,
      },

      sections: [
        {
          sectionSlug: "reasoning",
          order: 1,
          durationMinutes: 15,
        },
        {
          sectionSlug: "quantitative-aptitude",
          order: 2,
          durationMinutes: 15,
        },
        {
          sectionSlug: "english",
          order: 3,
          durationMinutes: 15,
        },
        {
          sectionSlug: "general-awareness",
          order: 4,
          durationMinutes: 15,
        },
      ],
    });

    await t.test(
      "legacy TestAttempt does not materialize timingState automatically",
      async () => {
        const attempt =
          new TestAttemptForTimingState({
            tenantId: "pravixoedutech",
            studentId:
              "507f1f77bcf86cd799439011",
            mockTestId:
              "507f1f77bcf86cd799439012",
            mockTestVersionId:
              "507f1f77bcf86cd799439013",
            attemptNumber: 1,
          });

        await attempt.validate();

        assert.equal(
          attempt.timingState,
          undefined
        );
      }
    );

    await t.test(
      "global V1 builds persistent mode without section windows",
      () => {
        const result =
          buildAttemptTimingState({
            startedAt:
              baseStartedAt,

            mockTestVersion: {
              examPatternSnapshot: {
                timingMode: "global",
                timingPolicyVersion: 1,
                totalDurationMinutes: 90,
              },

              sections: [
                {
                  sectionSlug:
                    "general-awareness",
                  order: 1,
                  durationMinutes: 0,
                },
              ],
            },
          });

        assert.deepEqual(
          result,
          {
            mode: "global",
            policyVersion: 1,
            sectionWindows: [],
          }
        );
      }
    );

    await t.test(
      "legacy global snapshot builds policy version zero",
      () => {
        const result =
          buildAttemptTimingState({
            startedAt:
              baseStartedAt,

            mockTestVersion: {
              examPatternSnapshot: {},
              sections: [],
            },
          });

        assert.deepEqual(
          result,
          {
            mode: "global",
            policyVersion: 0,
            sectionWindows: [],
          }
        );
      }
    );

    await t.test(
      "sectional V1 builds contiguous absolute windows from server startedAt",
      () => {
        const result =
          buildAttemptTimingState({
            mockTestVersion:
              makeSectionalVersion(),

            startedAt:
              baseStartedAt,
          });

        assert.equal(
          result.mode,
          "sectional"
        );

        assert.equal(
          result.policyVersion,
          1
        );

        assert.equal(
          result.sectionWindows.length,
          4
        );

        assert.deepEqual(
          result.sectionWindows.map(
            (window) => ({
              sectionSlug:
                window.sectionSlug,
              order:
                window.order,
              startsAt:
                window.startsAt.toISOString(),
              expiresAt:
                window.expiresAt.toISOString(),
            })
          ),
          [
            {
              sectionSlug: "reasoning",
              order: 1,
              startsAt:
                "2026-10-08T10:00:00.000Z",
              expiresAt:
                "2026-10-08T10:15:00.000Z",
            },
            {
              sectionSlug:
                "quantitative-aptitude",
              order: 2,
              startsAt:
                "2026-10-08T10:15:00.000Z",
              expiresAt:
                "2026-10-08T10:30:00.000Z",
            },
            {
              sectionSlug: "english",
              order: 3,
              startsAt:
                "2026-10-08T10:30:00.000Z",
              expiresAt:
                "2026-10-08T10:45:00.000Z",
            },
            {
              sectionSlug:
                "general-awareness",
              order: 4,
              startsAt:
                "2026-10-08T10:45:00.000Z",
              expiresAt:
                "2026-10-08T11:00:00.000Z",
            },
          ]
        );
      }
    );

    await t.test(
      "sectional builder does not mutate published section ordering",
      () => {
        const version =
          makeSectionalVersion();

        version.sections.reverse();

        const before =
          version.sections.map(
            (section) =>
              section.sectionSlug
          );

        buildAttemptTimingState({
          mockTestVersion:
            version,
          startedAt:
            baseStartedAt,
        });

        assert.deepEqual(
          version.sections.map(
            (section) =>
              section.sectionSlug
          ),
          before
        );
      }
    );

    await t.test(
      "sectional builder rejects duplicate slugs",
      () => {
        const version =
          makeSectionalVersion();

        version.sections[1].sectionSlug =
          "reasoning";

        assert.throws(
          () =>
            buildAttemptTimingState({
              mockTestVersion:
                version,
              startedAt:
                baseStartedAt,
            }),
          /sectionSlug values must be unique/
        );
      }
    );

    await t.test(
      "sectional builder rejects duplicate order values",
      () => {
        const version =
          makeSectionalVersion();

        version.sections[1].order = 1;

        assert.throws(
          () =>
            buildAttemptTimingState({
              mockTestVersion:
                version,
              startedAt:
                baseStartedAt,
            }),
          /order values must be unique/
        );
      }
    );

    await t.test(
      "sectional builder rejects duration mismatch",
      () => {
        const version =
          makeSectionalVersion();

        version.examPatternSnapshot
          .totalDurationMinutes = 65;

        assert.throws(
          () =>
            buildAttemptTimingState({
              mockTestVersion:
                version,
              startedAt:
                baseStartedAt,
            }),
          /duration total does not match/
        );
      }
    );

    await t.test(
      "sectional mode fails closed for legacy policy version zero",
      () => {
        const version =
          makeSectionalVersion();

        version.examPatternSnapshot
          .timingPolicyVersion = 0;

        assert.throws(
          () =>
            buildAttemptTimingState({
              mockTestVersion:
                version,
              startedAt:
                baseStartedAt,
            }),
          /Unsupported sectional attempt timing policy version/
        );
      }
    );

    await t.test(
      "legacy attempt with missing timingState resolves as global",
      () => {
        const resolved =
          resolveAttemptTimingState({
            attempt: {
              expiresAt:
                new Date(
                  "2026-10-08T11:00:00.000Z"
                ),
            },

            now:
              new Date(
                "2026-10-08T10:20:00.000Z"
              ),
          });

        assert.equal(
          resolved.mode,
          "global"
        );

        assert.equal(
          resolved.policyVersion,
          0
        );

        assert.equal(
          resolved.attemptExpired,
          false
        );

        assert.equal(
          resolved.overallRemainingSeconds,
          2400
        );

        assert.equal(
          resolved.activeSection,
          null
        );
      }
    );

    await t.test(
      "legacy global attempt still expires from overall server deadline",
      () => {
        const resolved =
          resolveAttemptTimingState({
            attempt: {
              expiresAt:
                new Date(
                  "2026-10-08T11:00:00.000Z"
                ),
            },

            now:
              new Date(
                "2026-10-08T11:00:00.000Z"
              ),
          });

        assert.equal(
          resolved.attemptExpired,
          true
        );

        assert.equal(
          resolved.overallRemainingSeconds,
          0
        );
      }
    );

    await t.test(
      "sectional resolver exposes only the first active window at start",
      () => {
        const timingState =
          buildAttemptTimingState({
            mockTestVersion:
              makeSectionalVersion(),
            startedAt:
              baseStartedAt,
          });

        const resolved =
          resolveAttemptTimingState({
            attempt: {
              timingState,
              expiresAt:
                new Date(
                  "2026-10-08T11:00:00.000Z"
                ),
            },

            now:
              new Date(
                "2026-10-08T10:00:00.000Z"
              ),
          });

        assert.equal(
          resolved.activeSection
            .sectionSlug,
          "reasoning"
        );

        assert.equal(
          resolved.activeSection
            .remainingSeconds,
          900
        );

        assert.deepEqual(
          resolved.expiredSectionSlugs,
          []
        );

        assert.deepEqual(
          resolved.lockedSectionSlugs,
          [
            "quantitative-aptitude",
            "english",
            "general-awareness",
          ]
        );
      }
    );

    await t.test(
      "exact section expiry activates next section without overlap",
      () => {
        const timingState =
          buildAttemptTimingState({
            mockTestVersion:
              makeSectionalVersion(),
            startedAt:
              baseStartedAt,
          });

        const resolved =
          resolveAttemptTimingState({
            attempt: {
              timingState,
              expiresAt:
                new Date(
                  "2026-10-08T11:00:00.000Z"
                ),
            },

            now:
              new Date(
                "2026-10-08T10:15:00.000Z"
              ),
          });

        assert.deepEqual(
          resolved.expiredSectionSlugs,
          ["reasoning"]
        );

        assert.equal(
          resolved.activeSection
            .sectionSlug,
          "quantitative-aptitude"
        );

        assert.equal(
          resolved.activeSection
            .remainingSeconds,
          900
        );
      }
    );

    await t.test(
      "resume later derives section from immutable absolute windows",
      () => {
        const timingState =
          buildAttemptTimingState({
            mockTestVersion:
              makeSectionalVersion(),
            startedAt:
              baseStartedAt,
          });

        const resolved =
          resolveAttemptTimingState({
            attempt: {
              timingState,
              expiresAt:
                new Date(
                  "2026-10-08T11:00:00.000Z"
                ),
            },

            now:
              new Date(
                "2026-10-08T10:37:00.000Z"
              ),
          });

        assert.deepEqual(
          resolved.expiredSectionSlugs,
          [
            "reasoning",
            "quantitative-aptitude",
          ]
        );

        assert.equal(
          resolved.activeSection
            .sectionSlug,
          "english"
        );

        assert.equal(
          resolved.activeSection
            .remainingSeconds,
          480
        );

        assert.deepEqual(
          resolved.lockedSectionSlugs,
          ["general-awareness"]
        );
      }
    );

    await t.test(
      "sectional schedule is expired when final absolute window ends",
      () => {
        const timingState =
          buildAttemptTimingState({
            mockTestVersion:
              makeSectionalVersion(),
            startedAt:
              baseStartedAt,
          });

        const resolved =
          resolveAttemptTimingState({
            attempt: {
              timingState,
              expiresAt:
                new Date(
                  "2026-10-08T11:00:00.000Z"
                ),
            },

            now:
              new Date(
                "2026-10-08T11:00:00.000Z"
              ),
          });

        assert.equal(
          resolved.attemptExpired,
          true
        );

        assert.equal(
          resolved.activeSection,
          null
        );

        assert.deepEqual(
          resolved.expiredSectionSlugs,
          [
            "reasoning",
            "quantitative-aptitude",
            "english",
            "general-awareness",
          ]
        );

        assert.deepEqual(
          resolved.lockedSectionSlugs,
          []
        );
      }
    );

    await t.test(
      "TestAttempt schema accepts valid persisted sectional timing state",
      async () => {
        const timingState =
          buildAttemptTimingState({
            mockTestVersion:
              makeSectionalVersion(),
            startedAt:
              baseStartedAt,
          });

        const attempt =
          new TestAttemptForTimingState({
            tenantId:
              "pravixoedutech",
            studentId:
              "507f1f77bcf86cd799439011",
            mockTestId:
              "507f1f77bcf86cd799439012",
            mockTestVersionId:
              "507f1f77bcf86cd799439013",
            attemptNumber: 1,
            startedAt:
              baseStartedAt,
            expiresAt:
              new Date(
                "2026-10-08T11:00:00.000Z"
              ),
            timingState,
          });

        await attempt.validate();

        assert.equal(
          attempt.timingState.mode,
          "sectional"
        );

        assert.equal(
          attempt.timingState
            .sectionWindows.length,
          4
        );
      }
    );

    await t.test(
      "TestAttempt schema rejects inverted section timing window",
      async () => {
        const attempt =
          new TestAttemptForTimingState({
            tenantId:
              "pravixoedutech",
            studentId:
              "507f1f77bcf86cd799439011",
            mockTestId:
              "507f1f77bcf86cd799439012",
            mockTestVersionId:
              "507f1f77bcf86cd799439013",
            attemptNumber: 1,

            // Match the intentionally malformed window boundaries
            // so this test isolates the child invariant:
            // expiresAt must be strictly after startsAt.
            startedAt:
              new Date(
                "2026-10-08T10:15:00.000Z"
              ),
            expiresAt:
              new Date(
                "2026-10-08T10:00:00.000Z"
              ),

            timingState: {
              mode: "sectional",
              policyVersion: 1,

              sectionWindows: [
                {
                  sectionSlug:
                    "reasoning",
                  order: 1,
                  startsAt:
                    new Date(
                      "2026-10-08T10:15:00.000Z"
                    ),
                  expiresAt:
                    new Date(
                      "2026-10-08T10:00:00.000Z"
                    ),
                },
              ],
            },
          });

        await assert.rejects(
          attempt.validate(),
          /expire after it starts/
        );
      }
    );
  }
);
test(
  "SECTION-TIMER-B3A-H1 model integrity contract",
  async (t) => {
    const baseAttemptData = () => ({
      tenantId:
        "pravixoedutech",
      studentId:
        "507f1f77bcf86cd799439011",
      mockTestId:
        "507f1f77bcf86cd799439012",
      mockTestVersionId:
        "507f1f77bcf86cd799439013",
      attemptNumber: 1,
      startedAt:
        new Date(
          "2026-10-08T10:00:00.000Z"
        ),
      expiresAt:
        new Date(
          "2026-10-08T10:30:00.000Z"
        ),
    });

    const validWindows = () => [
      {
        sectionSlug: "reasoning",
        order: 1,
        startsAt:
          new Date(
            "2026-10-08T10:00:00.000Z"
          ),
        expiresAt:
          new Date(
            "2026-10-08T10:15:00.000Z"
          ),
      },
      {
        sectionSlug: "maths",
        order: 2,
        startsAt:
          new Date(
            "2026-10-08T10:15:00.000Z"
          ),
        expiresAt:
          new Date(
            "2026-10-08T10:30:00.000Z"
          ),
      },
    ];

    await t.test(
      "timingState is immutable after creation",
      () => {
        const path =
          TestAttemptForTimingState
            .schema
            .path("timingState");

        assert.ok(path);

        assert.equal(
          path.options.immutable,
          true
        );
      }
    );

    await t.test(
      "global persisted timing state cannot contain section windows",
      async () => {
        const attempt =
          new TestAttemptForTimingState({
            ...baseAttemptData(),

            timingState: {
              mode: "global",
              policyVersion: 1,
              sectionWindows:
                validWindows(),
            },
          });

        await assert.rejects(
          attempt.validate(),
          /must not contain section windows/
        );
      }
    );

    await t.test(
      "sectional persisted timing state requires windows",
      async () => {
        const attempt =
          new TestAttemptForTimingState({
            ...baseAttemptData(),

            timingState: {
              mode: "sectional",
              policyVersion: 1,
              sectionWindows: [],
            },
          });

        await assert.rejects(
          attempt.validate(),
          /requires section windows/
        );
      }
    );

    await t.test(
      "sectional persisted timing state rejects duplicate slugs",
      async () => {
        const windows =
          validWindows();

        windows[1].sectionSlug =
          "reasoning";

        const attempt =
          new TestAttemptForTimingState({
            ...baseAttemptData(),

            timingState: {
              mode: "sectional",
              policyVersion: 1,
              sectionWindows:
                windows,
            },
          });

        await assert.rejects(
          attempt.validate(),
          /slugs must be unique/
        );
      }
    );

    await t.test(
      "sectional persisted timing state rejects duplicate order values",
      async () => {
        const windows =
          validWindows();

        windows[1].order = 1;

        const attempt =
          new TestAttemptForTimingState({
            ...baseAttemptData(),

            timingState: {
              mode: "sectional",
              policyVersion: 1,
              sectionWindows:
                windows,
            },
          });

        await assert.rejects(
          attempt.validate(),
          /orders must be unique/
        );
      }
    );

    await t.test(
      "sectional persisted timing state rejects gaps between windows",
      async () => {
        const windows =
          validWindows();

        windows[1].startsAt =
          new Date(
            "2026-10-08T10:16:00.000Z"
          );

        const attempt =
          new TestAttemptForTimingState({
            ...baseAttemptData(),

            timingState: {
              mode: "sectional",
              policyVersion: 1,
              sectionWindows:
                windows,
            },
          });

        await assert.rejects(
          attempt.validate(),
          /must be contiguous/
        );
      }
    );

    await t.test(
      "sectional schedule must begin at attempt startedAt",
      async () => {
        const attemptData =
          baseAttemptData();

        attemptData.startedAt =
          new Date(
            "2026-10-08T09:59:00.000Z"
          );

        const attempt =
          new TestAttemptForTimingState({
            ...attemptData,

            timingState: {
              mode: "sectional",
              policyVersion: 1,
              sectionWindows:
                validWindows(),
            },
          });

        await assert.rejects(
          attempt.validate(),
          /must start at attempt startedAt/
        );
      }
    );

    await t.test(
      "sectional schedule must end at attempt expiresAt",
      async () => {
        const attemptData =
          baseAttemptData();

        attemptData.expiresAt =
          new Date(
            "2026-10-08T10:31:00.000Z"
          );

        const attempt =
          new TestAttemptForTimingState({
            ...attemptData,

            timingState: {
              mode: "sectional",
              policyVersion: 1,
              sectionWindows:
                validWindows(),
            },
          });

        await assert.rejects(
          attempt.validate(),
          /must end at attempt expiresAt/
        );
      }
    );

    await t.test(
      "valid sectional model contract passes all structural guards",
      async () => {
        const attempt =
          new TestAttemptForTimingState({
            ...baseAttemptData(),

            timingState: {
              mode: "sectional",
              policyVersion: 1,
              sectionWindows:
                validWindows(),
            },
          });

        await attempt.validate();

        assert.equal(
          attempt.timingState.mode,
          "sectional"
        );
      }
    );
  }
);
const fsForB3BRuntime = require("node:fs");
const pathForB3BRuntime = require("node:path");

test(
  "SECTION-TIMER-B3B start resume integration contract",
  async (t) => {
    const controllerPath =
      pathForB3BRuntime.join(
        __dirname,
        "../src/controllers/studentMockTestController.js"
      );

    const readControllerSource = () =>
      fsForB3BRuntime.readFileSync(
        controllerPath,
        "utf8"
      );

    await t.test(
      "student controller imports both attempt timing builder and resolver",
      () => {
        const source =
          readControllerSource();

        assert.match(
          source,
          /buildAttemptTimingState/
        );

        assert.match(
          source,
          /resolveAttemptTimingState/
        );

        assert.match(
          source,
          /require\("\.\.\/utils\/attemptTimingPolicy"\)/
        );
      }
    );

    await t.test(
      "new attempt timing state is built from published version and same server now",
      () => {
        const source =
          readControllerSource();

        const startMatch =
          source.match(
            /const startMockTestAttempt = async \(req, res\) => \{[\s\S]*?^};/m
          );

        assert.ok(
          startMatch,
          "startMockTestAttempt source must be discoverable"
        );

        assert.match(
          startMatch[0],
          /const now = new Date\(\);/
        );

        assert.match(
          startMatch[0],
          /const timingState = buildAttemptTimingState\(\{\s*mockTestVersion,\s*startedAt: now,\s*\}\);/
        );

        assert.match(
          startMatch[0],
          /TestAttempt\.create\(\{[\s\S]*?startedAt: now,[\s\S]*?expiresAt,[\s\S]*?totalDurationSeconds,[\s\S]*?timingState,[\s\S]*?timeSpentSeconds: 0/
        );
      }
    );

    await t.test(
      "resume expiry uses central timing resolver rather than only raw expiresAt comparison",
      () => {
        const source =
          readControllerSource();

        const startMatch =
          source.match(
            /const startMockTestAttempt = async \(req, res\) => \{[\s\S]*?^};/m
          );

        assert.ok(startMatch);

        assert.match(
          startMatch[0],
          /const existingTimingState = resolveAttemptTimingState\(\{\s*attempt: existingAttempt,\s*now,\s*\}\);/
        );

        assert.match(
          startMatch[0],
          /existingTimingState\.attemptExpired/
        );

        assert.doesNotMatch(
          startMatch[0],
          /existingAttempt\.expiresAt\s*&&\s*existingAttempt\.expiresAt\s*<=\s*now/
        );
      }
    );

    await t.test(
      "start and resume payloads use the same request server clock",
      () => {
        const source =
          readControllerSource();

        const startMatch =
          source.match(
            /const startMockTestAttempt = async \(req, res\) => \{[\s\S]*?^};/m
          );

        assert.ok(startMatch);

        const payloadCalls =
          startMatch[0].match(
            /buildAttemptPayload\([\s\S]*?\)/g
          ) || [];

        assert.ok(
          payloadCalls.length >= 2,
          "start and resume must both build attempt payloads"
        );

        assert.match(
          startMatch[0],
          /buildAttemptPayload\(\s*existingAttempt,\s*resumeMockTestVersion,\s*true,\s*attemptDetail,\s*now\s*\)/
        );

        assert.match(
          startMatch[0],
          /buildAttemptPayload\(\s*attempt,\s*mockTestVersion,\s*false,\s*attemptDetail,\s*now\s*\)/
        );
      }
    );

    await t.test(
      "attempt payload exposes sanitized authoritative timing state",
      () => {
        const source =
          readControllerSource();

        const payloadMatch =
          source.match(
            /const buildAttemptTimingPayload = \(attempt, serverNow\) => \{[\s\S]*?^};[\s\S]*?const buildAttemptPayload = \([\s\S]*?^};/m
          );

        assert.ok(
          payloadMatch,
          "attempt timing payload source must be discoverable"
        );

        assert.match(
          payloadMatch[0],
          /resolveAttemptTimingState\(\{\s*attempt,\s*now: serverNow,\s*\}\)/
        );

        assert.match(
          payloadMatch[0],
          /serverTime: serverNow/
        );

        assert.match(
          payloadMatch[0],
          /timing: buildAttemptTimingPayload\(attempt, serverNow\)/
        );

        for (
          const field of [
            "mode",
            "policyVersion",
            "attemptExpired",
            "overallExpiresAt",
            "overallRemainingSeconds",
            "activeSection",
            "expiredSectionSlugs",
            "lockedSectionSlugs",
          ]
        ) {
          assert.match(
            payloadMatch[0],
            new RegExp(
              `${field}: timingState\\.${field}`
            )
          );
        }

        assert.doesNotMatch(
          payloadMatch[0],
          /sectionWindows: timingState\.sectionWindows/
        );
      }
    );

    await t.test(
      "legacy attempts are not backfilled with mutable timing state on resume",
      () => {
        const source =
          readControllerSource();

        const startMatch =
          source.match(
            /const startMockTestAttempt = async \(req, res\) => \{[\s\S]*?^};/m
          );

        assert.ok(startMatch);

        const resumeBlockMatch =
          startMatch[0].match(
            /if \(existingAttempt\) \{[\s\S]*?return res\.status\(200\)\.json\(\{[\s\S]*?message: "Attempt resumed successfully"[\s\S]*?\}\);\s*\}/
          );

        assert.ok(
          resumeBlockMatch,
          "resume block must be discoverable"
        );

        assert.doesNotMatch(
          resumeBlockMatch[0],
          /existingAttempt\.timingState\s*=/
        );
      }
    );

    await t.test(
      "B4 answer mutation uses authoritative sectional access",
      () => {
        const source = readControllerSource();

        const saveMatch = source.match(
          /const saveMockTestAnswer = async \(req, res\) => \{[\s\S]*?(?=\nconst roundToTwo =)/
        );

        assert.ok(
          saveMatch,
          "saveMockTestAnswer source must be discoverable"
        );

        const saveSource = saveMatch[0];

        assert.match(
          saveSource,
          /resolveAttemptTimingState/
        );

        assert.match(
          saveSource,
          /timingState\.attemptExpired/
        );

        assert.match(
          saveSource,
          /timingState\.mode === "sectional"/
        );

        assert.match(
          saveSource,
          /timingState\.activeSection\.sectionSlug/
        );

        assert.match(
          saveSource,
          /questionSection\.sectionSlug/
        );

        assert.match(
          saveSource,
          /Question section is not currently active/
        );

        const sectionGuardPosition = saveSource.indexOf(
          'if (timingState.mode === "sectional")'
        );

        const answerDetailPosition = saveSource.indexOf(
          "const attemptDetail = await getOrCreateAttemptDetail"
        );

        assert.ok(sectionGuardPosition >= 0);

        assert.ok(
          answerDetailPosition > sectionGuardPosition,
          "section authorization must precede answer-detail access"
        );
      }
    );
  }
);
