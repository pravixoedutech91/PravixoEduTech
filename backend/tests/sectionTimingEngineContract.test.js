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