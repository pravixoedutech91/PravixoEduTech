const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  createPaymentPackageOrderForStudent,
  verifyPaymentPackagePaymentForStudent,
} = require(
  "../src/controllers/studentMockTestController"
);

const ENV_KEYS = [
  "NODE_ENV",
  "RAILWAY_ENVIRONMENT_NAME",
  "RAILWAY_DEPLOYMENT_ID",
  "PAYMENTS_ENABLED",
];

const STUDENT_ID =
  "507f1f77bcf86cd799439011";

const snapshotEnvironment = () => {
  const snapshot = {};

  for (const key of ENV_KEYS) {
    snapshot[key] =
      Object.prototype.hasOwnProperty.call(
        process.env,
        key
      )
        ? process.env[key]
        : undefined;
  }

  return snapshot;
};

const restoreEnvironment = (
  snapshot
) => {
  for (const key of ENV_KEYS) {
    if (snapshot[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] =
        snapshot[key];
    }
  }
};

const setEnvironmentValue = (
  key,
  value
) => {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] =
    value;
};

const configureRuntime = ({
  nodeEnv = "development",
  railwayEnvironmentName,
  railwayDeploymentId,
  paymentsEnabled,
} = {}) => {
  setEnvironmentValue(
    "NODE_ENV",
    nodeEnv
  );

  setEnvironmentValue(
    "RAILWAY_ENVIRONMENT_NAME",
    railwayEnvironmentName
  );

  setEnvironmentValue(
    "RAILWAY_DEPLOYMENT_ID",
    railwayDeploymentId
  );

  setEnvironmentValue(
    "PAYMENTS_ENABLED",
    paymentsEnabled
  );
};

const makeRequest = ({
  productId = "not-an-object-id",
  body = {},
} = {}) => ({
  user: {
    _id:
      STUDENT_ID,

    tenantId:
      "pravixoedutech",

    role:
      "student",
  },

  params: {
    productId,
  },

  body,
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

const runCreateOrder = async () => {
  const req =
    makeRequest();

  const res =
    makeResponse();

  await createPaymentPackageOrderForStudent(
    req,
    res
  );

  return res;
};

const runVerifyPayment = async () => {
  const req =
    makeRequest({
      body: {},
    });

  const res =
    makeResponse();

  await verifyPaymentPackagePaymentForStudent(
    req,
    res
  );

  return res;
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
      const snapshot =
        snapshotEnvironment();

      try {
        await fn();
      } finally {
        restoreEnvironment(
          snapshot
        );
      }
    }
  );

serialTest(
  "local development preserves existing checkout path when payment flag is absent",
  async () => {
    configureRuntime({
      nodeEnv:
        "development",

      railwayEnvironmentName:
        undefined,

      railwayDeploymentId:
        undefined,

      paymentsEnabled:
        undefined,
    });

    const res =
      await runCreateOrder();

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
      "Invalid payment package ID"
    );
  }
);

serialTest(
  "hosted production fails closed unless payment flag is exact lowercase true",
  async () => {
    const closedValues = [
      undefined,
      "false",
      "FALSE",
      "TRUE",
      "1",
      " true ",
    ];

    for (const value of closedValues) {
      configureRuntime({
        nodeEnv:
          "production",

        railwayEnvironmentName:
          undefined,

        railwayDeploymentId:
          undefined,

        paymentsEnabled:
          value,
      });

      const res =
        await runCreateOrder();

      assert.equal(
        res.statusCode,
        503
      );

      assert.equal(
        res.body.success,
        false
      );

      assert.equal(
        res.body.message,
        "Payment checkout is currently unavailable"
      );
    }
  }
);

serialTest(
  "hosted production allows new-order path only for exact lowercase true",
  async () => {
    configureRuntime({
      nodeEnv:
        "production",

      railwayEnvironmentName:
        undefined,

      railwayDeploymentId:
        undefined,

      paymentsEnabled:
        "true",
    });

    const res =
      await runCreateOrder();

    assert.equal(
      res.statusCode,
      400
    );

    assert.equal(
      res.body.message,
      "Invalid payment package ID"
    );
  }
);

serialTest(
  "Railway runtime is fail closed even when NODE_ENV is development",
  async () => {
    configureRuntime({
      nodeEnv:
        "development",

      railwayEnvironmentName:
        "production",

      railwayDeploymentId:
        undefined,

      paymentsEnabled:
        undefined,
    });

    const res =
      await runCreateOrder();

    assert.equal(
      res.statusCode,
      503
    );

    assert.equal(
      res.body.message,
      "Payment checkout is currently unavailable"
    );
  }
);

serialTest(
  "closed new-order gate does not block verification of an existing payment",
  async () => {
    configureRuntime({
      nodeEnv:
        "production",

      railwayEnvironmentName:
        undefined,

      railwayDeploymentId:
        undefined,

      paymentsEnabled:
        "false",
    });

    const res =
      await runVerifyPayment();

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
      "Razorpay payment ID, order ID, and signature are required"
    );
  }
);

serialTest(
  "source contract locks hosted gate default while webhook remains settlement-capable",
  async () => {
    const controllerPath =
      path.join(
        __dirname,
        "..",
        "src",
        "controllers",
        "studentMockTestController.js"
      );

    const webhookPath =
      path.join(
        __dirname,
        "..",
        "src",
        "controllers",
        "razorpayWebhookController.js"
      );

    const envPath =
      path.join(
        __dirname,
        "..",
        ".env.example"
      );

    const controllerSource =
      fs.readFileSync(
        controllerPath,
        "utf8"
      );

    const webhookSource =
      fs.readFileSync(
        webhookPath,
        "utf8"
      );

    const envSource =
      fs.readFileSync(
        envPath,
        "utf8"
      );

    assert.equal(
      controllerSource.includes(
        'process.env.PAYMENTS_ENABLED === "true"'
      ),
      true
    );

    assert.equal(
      controllerSource.includes(
        "!isHostedEnvironment() ||"
      ),
      true
    );

    assert.equal(
      controllerSource.includes(
        "if (!isPaymentOrderCreationEnabled())"
      ),
      true
    );

    const createStart =
      controllerSource.indexOf(
        "const createPaymentPackageOrderForStudent"
      );

    const verifyStart =
      controllerSource.indexOf(
        "const verifyPaymentPackagePaymentForStudent"
      );

    assert.ok(
      createStart >= 0
    );

    assert.ok(
      verifyStart > createStart
    );

    const createSource =
      controllerSource.slice(
        createStart,
        verifyStart
      );

    const gateIndex =
      createSource.indexOf(
        "if (!isPaymentOrderCreationEnabled())"
      );

    const tenantIndex =
      createSource.indexOf(
        "const tenantId = getStudentTenantId(req);"
      );

    assert.ok(
      gateIndex >= 0
    );

    assert.ok(
      tenantIndex > gateIndex
    );

    const verifySource =
      controllerSource.slice(
        verifyStart
      );

    assert.equal(
      verifySource.includes(
        "if (!isPaymentOrderCreationEnabled())"
      ),
      false
    );

    assert.equal(
      webhookSource.includes(
        "PAYMENTS_ENABLED"
      ),
      false
    );

    const envMatches =
      envSource.match(
        /^PAYMENTS_ENABLED=false\r?$/gm
      ) || [];

    assert.equal(
      envMatches.length,
      1
    );
  }
);
serialTest(
  "backend-authored checkout availability keeps frontend fail closed without duplicate launch authority",
  async () => {
    const controllerPath =
      path.join(
        __dirname,
        "..",
        "src",
        "controllers",
        "studentMockTestController.js"
      );

    const frontendPath =
      path.join(
        __dirname,
        "..",
        "..",
        "frontend",
        "app",
        "student",
        "mock-tests",
        "page.tsx"
      );

    const controllerSource =
      fs.readFileSync(
        controllerPath,
        "utf8"
      );

    const frontendSource =
      fs.readFileSync(
        frontendPath,
        "utf8"
      );

    const listStart =
      controllerSource.indexOf(
        "const getActivePaymentPackagesForStudent"
      );

    const createStart =
      controllerSource.indexOf(
        "const createPaymentPackageOrderForStudent"
      );

    assert.ok(
      listStart >= 0
    );

    assert.ok(
      createStart > listStart
    );

    const listSource =
      controllerSource.slice(
        listStart,
        createStart
      );

    assert.equal(
      listSource.includes(
        "checkout: {"
      ),
      true
    );

    assert.equal(
      listSource.includes(
        "available: isPaymentOrderCreationEnabled(),"
      ),
      true
    );

    assert.equal(
      listSource.includes(
        "keySecret"
      ),
      false
    );

    assert.equal(
      listSource.includes(
        "keyId"
      ),
      false
    );

    assert.equal(
      frontendSource.includes(
        "checkout?: {"
      ),
      true
    );

    assert.equal(
      frontendSource.includes(
        "available?: boolean;"
      ),
      true
    );

    assert.equal(
      frontendSource.includes(
        "const [isPaymentCheckoutAvailable, setIsPaymentCheckoutAvailable] = useState(false);"
      ),
      true
    );

    assert.equal(
      frontendSource.includes(
        "setIsPaymentCheckoutAvailable(result.checkout?.available === true);"
      ),
      true
    );

    assert.equal(
      frontendSource.includes(
        "if (!isPaymentCheckoutAvailable) {"
      ),
      true
    );

    assert.equal(
      frontendSource.includes(
        "!isPaymentCheckoutAvailable ||"
      ),
      true
    );

    assert.equal(
      frontendSource.includes(
        "Secure checkout powered by Razorpay. Access unlocks only after verified payment."
      ),
      true
    );

    assert.equal(
      frontendSource.includes(
        "Purchases are temporarily unavailable. Existing purchased access remains available."
      ),
      true
    );

    assert.equal(
      frontendSource.includes(
        "Razorpay Test Mode"
      ),
      false
    );

    assert.equal(
      frontendSource.includes(
        "Live Mode"
      ),
      false
    );

    assert.equal(
      frontendSource.includes(
        "PAYMENTS_ENABLED"
      ),
      false
    );

    assert.equal(
      frontendSource.includes(
        "NEXT_PUBLIC_PAYMENTS_ENABLED"
      ),
      false
    );
  }
);
serialTest(
  "backend Razorpay configuration errors remain mode neutral",
  async () => {
    const controllerPath =
      path.join(
        __dirname,
        "..",
        "src",
        "controllers",
        "studentMockTestController.js"
      );

    const controllerSource =
      fs.readFileSync(
        controllerPath,
        "utf8"
      );

    const neutralMessage =
      "Razorpay credentials are not configured on backend";

    assert.equal(
      controllerSource.split(neutralMessage).length - 1,
      2
    );

    assert.equal(
      controllerSource.includes(
        "Razorpay test keys"
      ),
      false
    );

    assert.equal(
      controllerSource.includes(
        "Razorpay live keys"
      ),
      false
    );

    assert.equal(
      controllerSource.includes(
        "Test Mode"
      ),
      false
    );

    assert.equal(
      controllerSource.includes(
        "Live Mode"
      ),
      false
    );
  }
);
