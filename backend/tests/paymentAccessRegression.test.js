const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const MockTest =
  require("../src/models/MockTest");

const MockTestVersion =
  require("../src/models/MockTestVersion");

const Entitlement =
  require("../src/models/Entitlement");

const TestAttempt =
  require("../src/models/TestAttempt");

const controllerPath =
  require.resolve(
    "../src/controllers/studentMockTestController"
  );

const originalControllerCache =
  require.cache[controllerPath];

const ORIGINALS = {
  mockTestFindOne:
    MockTest.findOne,

  mockTestVersionFindOne:
    MockTestVersion.findOne,

  entitlementExists:
    Entitlement.exists,

  testAttemptFindOne:
    TestAttempt.findOne,

  testAttemptCountDocuments:
    TestAttempt.countDocuments,

  testAttemptCreate:
    TestAttempt.create,
};

delete require.cache[
  controllerPath
];

const {
  startMockTestAttempt,
} = require(
  "../src/controllers/studentMockTestController"
);

const TENANT_ID =
  "pravixoedutech";

const STUDENT_ID =
  "507f1f77bcf86cd799439011";

const MOCK_TEST_ID =
  "507f1f77bcf86cd799439012";

const VERSION_ID =
  "507f1f77bcf86cd799439013";

let currentMockTest;
let entitlementExistsValue;
let currentMockTestVersion;

let mockTestFindCalls;
let entitlementExistsCalls;
let versionFindCalls;
let attemptFindCalls;
let attemptCountCalls;
let attemptCreateCalls;

const makeMockTest = (
  overrides = {}
) => ({
  _id:
    MOCK_TEST_ID,

  tenantId:
    TENANT_ID,

  title:
    "Paid Access Contract Test",

  slug:
    "paid-access-contract-test",

  accessType:
    "paid",

  isActive:
    true,

  isPublished:
    true,

  activeVersionId:
    VERSION_ID,

  ...overrides,
});

const makeRequest = ({
  mockTestId = MOCK_TEST_ID,
} = {}) => ({
  user: {
    _id:
      STUDENT_ID,

    tenantId:
      TENANT_ID,

    role:
      "student",
  },

  params: {
    mockTestId,
  },
});

const makeResponse = () => ({
  statusCode:
    200,

  body:
    undefined,

  status(code) {
    this.statusCode =
      code;

    return this;
  },

  json(payload) {
    this.body =
      payload;

    return this;
  },
});

const resetRuntime = () => {
  currentMockTest =
    makeMockTest();

  entitlementExistsValue =
    false;

  currentMockTestVersion =
    null;

  mockTestFindCalls = [];
  entitlementExistsCalls = [];
  versionFindCalls = [];
  attemptFindCalls = [];
  attemptCountCalls = [];
  attemptCreateCalls = [];

  MockTest.findOne =
    async (filter) => {
      mockTestFindCalls.push(
        filter
      );

      return currentMockTest;
    };

  Entitlement.exists =
    async (filter) => {
      entitlementExistsCalls.push(
        filter
      );

      return entitlementExistsValue
        ? {
            _id:
              "507f1f77bcf86cd799439099",
          }
        : null;
    };

  MockTestVersion.findOne =
    async (filter) => {
      versionFindCalls.push(
        filter
      );

      return currentMockTestVersion;
    };

  TestAttempt.findOne =
    async (filter) => {
      attemptFindCalls.push(
        filter
      );

      return null;
    };

  TestAttempt.countDocuments =
    async (filter) => {
      attemptCountCalls.push(
        filter
      );

      return 0;
    };

  TestAttempt.create =
    async (payload) => {
      attemptCreateCalls.push(
        payload
      );

      throw new Error(
        "B4 test should not create an attempt"
      );
    };
};

const runStart = async ({
  mockTestId = MOCK_TEST_ID,
} = {}) => {
  const req =
    makeRequest({
      mockTestId,
    });

  const res =
    makeResponse();

  await startMockTestAttempt(
    req,
    res
  );

  return {
    req,
    res,
  };
};

const assertNoAttemptWork = () => {
  assert.equal(
    attemptFindCalls.length,
    0
  );

  assert.equal(
    attemptCountCalls.length,
    0
  );

  assert.equal(
    attemptCreateCalls.length,
    0
  );
};

const serialTest = (
  name,
  fn
) =>
  test(
    name,
    {
      concurrency: false,
    },
    async () => {
      resetRuntime();
      await fn();
    }
  );

serialTest(
  "invalid mock test ID fails before any database access",
  async () => {
    const {
      res,
    } =
      await runStart({
        mockTestId:
          "not-an-object-id",
      });

    assert.equal(
      res.statusCode,
      400
    );

    assert.equal(
      res.body.success,
      false
    );

    assert.equal(
      res.body.message,
      "Invalid mock test ID"
    );

    assert.equal(
      mockTestFindCalls.length,
      0
    );

    assert.equal(
      entitlementExistsCalls.length,
      0
    );

    assert.equal(
      versionFindCalls.length,
      0
    );

    assertNoAttemptWork();
  }
);

serialTest(
  "mock test authority is tenant scoped active and published before payment access evaluation",
  async () => {
    currentMockTest =
      null;

    const {
      res,
    } =
      await runStart();

    assert.equal(
      res.statusCode,
      404
    );

    assert.equal(
      res.body.success,
      false
    );

    assert.equal(
      res.body.message,
      "Mock test not found, unpublished, or access denied"
    );

    assert.equal(
      mockTestFindCalls.length,
      1
    );

    assert.deepEqual(
      mockTestFindCalls[0],
      {
        _id:
          MOCK_TEST_ID,

        tenantId:
          TENANT_ID,

        isActive:
          true,

        isPublished:
          true,
      }
    );

    assert.equal(
      entitlementExistsCalls.length,
      0
    );

    assert.equal(
      versionFindCalls.length,
      0
    );

    assertNoAttemptWork();
  }
);

serialTest(
  "paid start or resume fails closed before version or attempt work without active entitlement",
  async () => {
    currentMockTest =
      makeMockTest({
        accessType:
          "paid",
      });

    entitlementExistsValue =
      false;

    const before =
      Date.now();

    const {
      res,
    } =
      await runStart();

    const after =
      Date.now();

    assert.equal(
      res.statusCode,
      403
    );

    assert.equal(
      res.body.success,
      false
    );

    assert.equal(
      res.body.message,
      "Purchase required before starting this mock test"
    );

    assert.equal(
      entitlementExistsCalls.length,
      1
    );

    const accessQuery =
      entitlementExistsCalls[0];

    assert.equal(
      accessQuery.tenantId,
      TENANT_ID
    );

    assert.equal(
      accessQuery.studentId,
      STUDENT_ID
    );

    assert.equal(
      accessQuery.entitlementType,
      "mock_test_pack"
    );

    assert.equal(
      accessQuery.status,
      "active"
    );

    assert.equal(
      accessQuery.mockTestIds,
      MOCK_TEST_ID
    );

    assert.ok(
      accessQuery.validFrom
        .$lte instanceof Date
    );

    assert.ok(
      accessQuery.validUntil
        .$gte instanceof Date
    );

    assert.equal(
      accessQuery.validFrom
        .$lte,
      accessQuery.validUntil
        .$gte
    );

    assert.ok(
      accessQuery.validFrom
        .$lte.getTime() >=
        before
    );

    assert.ok(
      accessQuery.validFrom
        .$lte.getTime() <=
        after
    );

    assert.equal(
      versionFindCalls.length,
      0
    );

    assertNoAttemptWork();
  }
);

serialTest(
  "valid paid entitlement passes payment gate and reaches active version boundary",
  async () => {
    currentMockTest =
      makeMockTest({
        accessType:
          "paid",
      });

    entitlementExistsValue =
      true;

    currentMockTestVersion =
      null;

    const {
      res,
    } =
      await runStart();

    assert.equal(
      res.statusCode,
      404
    );

    assert.equal(
      res.body.success,
      false
    );

    assert.equal(
      res.body.message,
      "Active mock test version not found"
    );

    assert.equal(
      entitlementExistsCalls.length,
      1
    );

    assert.equal(
      versionFindCalls.length,
      1
    );

    assert.deepEqual(
      versionFindCalls[0],
      {
        _id:
          VERSION_ID,

        tenantId:
          TENANT_ID,

        isActive:
          true,
      }
    );

    assertNoAttemptWork();
  }
);

serialTest(
  "free mock test bypasses payment entitlement lookup and reaches version boundary",
  async () => {
    currentMockTest =
      makeMockTest({
        accessType:
          "free",
      });

    currentMockTestVersion =
      null;

    const {
      res,
    } =
      await runStart();

    assert.equal(
      res.statusCode,
      404
    );

    assert.equal(
      res.body.message,
      "Active mock test version not found"
    );

    assert.equal(
      entitlementExistsCalls.length,
      0
    );

    assert.equal(
      versionFindCalls.length,
      1
    );

    assertNoAttemptWork();
  }
);

serialTest(
  "assigned mock test remains denied by separate assignment boundary without using payment entitlement",
  async () => {
    currentMockTest =
      makeMockTest({
        accessType:
          "assigned",
      });

    const {
      res,
    } =
      await runStart();

    assert.equal(
      res.statusCode,
      403
    );

    assert.equal(
      res.body.success,
      false
    );

    assert.equal(
      res.body.message,
      "This mock test requires assignment before access"
    );

    assert.equal(
      entitlementExistsCalls.length,
      0
    );

    assert.equal(
      versionFindCalls.length,
      0
    );

    assertNoAttemptWork();
  }
);

serialTest(
  "student start route remains protected student-only feature-gated before start handler",
  async () => {
    const routePath =
      path.join(
        __dirname,
        "..",
        "src",
        "routes",
        "studentMockTestRoutes.js"
      );

    const source =
      fs.readFileSync(
        routePath,
        "utf8"
      );

    const pathMatches =
      source.match(
        /\/mock-tests\/:mockTestId\/start/g
      ) || [];

    assert.equal(
      pathMatches.length,
      1
    );

    const hardenedRoute =
      /router\.post\(\s*["']\/mock-tests\/:mockTestId\/start["']\s*,\s*protect\s*,\s*authorize\(\s*["']student["']\s*\)\s*,\s*checkFeatureAccess\(\s*["']mockTests["']\s*\)\s*,\s*startMockTestAttempt\s*\)/s;

    assert.equal(
      hardenedRoute.test(
        source
      ),
      true
    );
  }
);

test.after(() => {
  MockTest.findOne =
    ORIGINALS.mockTestFindOne;

  MockTestVersion.findOne =
    ORIGINALS.mockTestVersionFindOne;

  Entitlement.exists =
    ORIGINALS.entitlementExists;

  TestAttempt.findOne =
    ORIGINALS.testAttemptFindOne;

  TestAttempt.countDocuments =
    ORIGINALS.testAttemptCountDocuments;

  TestAttempt.create =
    ORIGINALS.testAttemptCreate;

  if (
    originalControllerCache
  ) {
    require.cache[
      controllerPath
    ] =
      originalControllerCache;
  } else {
    delete require.cache[
      controllerPath
    ];
  }
});
