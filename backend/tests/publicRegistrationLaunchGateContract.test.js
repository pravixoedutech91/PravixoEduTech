const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const Tenant = require("../src/models/Tenant");

const {
  requirePublicRegistrationAvailable,
} = require("../src/middleware/publicRegistrationMiddleware");

const {
  DEFAULT_PUBLIC_REGISTRATION_TENANT_ID,
  getConfiguredPublicRegistrationTenantId,
  resolvePublicRegistrationTenant,
} = require("../src/middleware/registrationTenantMiddleware");

const ENV_KEYS = [
  "NODE_ENV",
  "RAILWAY_ENVIRONMENT_NAME",
  "RAILWAY_DEPLOYMENT_ID",
  "PUBLIC_REGISTRATION_ENABLED",
  "PUBLIC_REGISTRATION_TENANT_ID",
];

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

const restoreEnvironment = (snapshot) => {
  for (const key of ENV_KEYS) {
    if (snapshot[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = snapshot[key];
    }
  }
};

const setEnvironmentValue = (key, value) => {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
};

const configureRuntime = ({
  nodeEnv = "development",
  railwayEnvironmentName,
  railwayDeploymentId,
  registrationEnabled,
  registrationTenantId,
} = {}) => {
  setEnvironmentValue("NODE_ENV", nodeEnv);

  setEnvironmentValue(
    "RAILWAY_ENVIRONMENT_NAME",
    railwayEnvironmentName
  );

  setEnvironmentValue(
    "RAILWAY_DEPLOYMENT_ID",
    railwayDeploymentId
  );

  setEnvironmentValue(
    "PUBLIC_REGISTRATION_ENABLED",
    registrationEnabled
  );

  setEnvironmentValue(
    "PUBLIC_REGISTRATION_TENANT_ID",
    registrationTenantId
  );
};

const createResponse = () => ({
  statusCode: 200,
  body: undefined,

  status(code) {
    this.statusCode = code;
    return this;
  },

  json(payload) {
    this.body = payload;
    return this;
  },
});

const runMiddleware = async (middleware, req = {}) => {
  const res = createResponse();
  let nextCalled = false;

  await middleware(
    req,
    res,
    () => {
      nextCalled = true;
    }
  );

  return {
    res,
    nextCalled,
  };
};

const assertUnavailable = (result) => {
  assert.equal(result.nextCalled, false);
  assert.equal(result.res.statusCode, 503);

  assert.deepEqual(
    result.res.body,
    {
      success: false,
      message: "Registration is currently unavailable",
    }
  );
};

test("local development keeps public registration available without a launch flag", async () => {
  const snapshot = snapshotEnvironment();

  try {
    configureRuntime();

    let result = await runMiddleware(
      requirePublicRegistrationAvailable
    );

    assert.equal(result.nextCalled, true);
    assert.equal(result.res.statusCode, 200);

    configureRuntime({
      registrationEnabled: "false",
    });

    result = await runMiddleware(
      requirePublicRegistrationAvailable
    );

    assert.equal(result.nextCalled, true);
    assert.equal(result.res.statusCode, 200);
  } finally {
    restoreEnvironment(snapshot);
  }
});

test("production registration is fail-closed unless the flag is exact lowercase true", async () => {
  const snapshot = snapshotEnvironment();

  try {
    const blockedValues = [
      undefined,
      "false",
      "1",
      "yes",
      "TRUE",
      " true ",
    ];

    for (const value of blockedValues) {
      configureRuntime({
        nodeEnv: "production",
        registrationEnabled: value,
      });

      const result = await runMiddleware(
        requirePublicRegistrationAvailable
      );

      assertUnavailable(result);
    }

    configureRuntime({
      nodeEnv: "production",
      registrationEnabled: "true",
    });

    const allowed = await runMiddleware(
      requirePublicRegistrationAvailable
    );

    assert.equal(allowed.nextCalled, true);
    assert.equal(allowed.res.statusCode, 200);
  } finally {
    restoreEnvironment(snapshot);
  }
});

test("Railway runtime uses the same fail-closed launch flag", async () => {
  const snapshot = snapshotEnvironment();

  try {
    configureRuntime({
      railwayEnvironmentName: "production",
    });

    let result = await runMiddleware(
      requirePublicRegistrationAvailable
    );

    assertUnavailable(result);

    configureRuntime({
      railwayDeploymentId: "deployment-123",
      registrationEnabled: "true",
    });

    result = await runMiddleware(
      requirePublicRegistrationAvailable
    );

    assert.equal(result.nextCalled, true);
    assert.equal(result.res.statusCode, 200);
  } finally {
    restoreEnvironment(snapshot);
  }
});

test("local registration tenant keeps the existing trusted default and ignores body tenantId", async () => {
  const snapshot = snapshotEnvironment();
  const originalFindOne = Tenant.findOne;
  let receivedFilter;

  try {
    configureRuntime();

    assert.equal(
      getConfiguredPublicRegistrationTenantId(),
      DEFAULT_PUBLIC_REGISTRATION_TENANT_ID
    );

    Tenant.findOne = async (filter) => {
      receivedFilter = filter;

      return {
        slug: DEFAULT_PUBLIC_REGISTRATION_TENANT_ID,
        isActive: true,
        limits: {
          maxStudents: 0,
        },
      };
    };

    const req = {
      body: {
        tenantId: "malicious-other-tenant",
      },
    };

    const result = await runMiddleware(
      resolvePublicRegistrationTenant,
      req
    );

    assert.equal(result.nextCalled, true);

    assert.deepEqual(
      receivedFilter,
      {
        slug: DEFAULT_PUBLIC_REGISTRATION_TENANT_ID,
      }
    );

    assert.equal(
      req.registrationTenantId,
      DEFAULT_PUBLIC_REGISTRATION_TENANT_ID
    );
  } finally {
    Tenant.findOne = originalFindOne;
    restoreEnvironment(snapshot);
  }
});

test("hosted registration tenant fails closed when explicit configuration is missing", async () => {
  const snapshot = snapshotEnvironment();
  const originalFindOne = Tenant.findOne;
  let findOneCalled = false;

  try {
    configureRuntime({
      nodeEnv: "production",
      registrationEnabled: "true",
    });

    Tenant.findOne = async () => {
      findOneCalled = true;
      return null;
    };

    assert.equal(
      getConfiguredPublicRegistrationTenantId(),
      ""
    );

    const result = await runMiddleware(
      resolvePublicRegistrationTenant,
      {}
    );

    assertUnavailable(result);
    assert.equal(findOneCalled, false);
  } finally {
    Tenant.findOne = originalFindOne;
    restoreEnvironment(snapshot);
  }
});

test("hosted registration uses only the explicit normalized tenant authority", async () => {
  const snapshot = snapshotEnvironment();
  const originalFindOne = Tenant.findOne;
  let receivedFilter;

  try {
    configureRuntime({
      nodeEnv: "production",
      registrationEnabled: "true",
      registrationTenantId: "  PRAVIXOEDUTECH  ",
    });

    Tenant.findOne = async (filter) => {
      receivedFilter = filter;

      return {
        slug: "pravixoedutech",
        isActive: true,
        limits: {
          maxStudents: 0,
        },
      };
    };

    const req = {
      body: {
        tenantId: "attacker-controlled-tenant",
      },
    };

    const result = await runMiddleware(
      resolvePublicRegistrationTenant,
      req
    );

    assert.equal(result.nextCalled, true);

    assert.deepEqual(
      receivedFilter,
      {
        slug: "pravixoedutech",
      }
    );

    assert.equal(
      req.registrationTenantId,
      "pravixoedutech"
    );
  } finally {
    Tenant.findOne = originalFindOne;
    restoreEnvironment(snapshot);
  }
});

test("missing or inactive configured hosted tenant remains a generic 503", async () => {
  const snapshot = snapshotEnvironment();
  const originalFindOne = Tenant.findOne;

  try {
    configureRuntime({
      nodeEnv: "production",
      registrationEnabled: "true",
      registrationTenantId: "pravixoedutech",
    });

    Tenant.findOne = async () => null;

    let result = await runMiddleware(
      resolvePublicRegistrationTenant,
      {}
    );

    assertUnavailable(result);

    Tenant.findOne = async () => ({
      slug: "pravixoedutech",
      isActive: false,
    });

    result = await runMiddleware(
      resolvePublicRegistrationTenant,
      {}
    );

    assertUnavailable(result);
  } finally {
    Tenant.findOne = originalFindOne;
    restoreEnvironment(snapshot);
  }
});

test("source and env documentation lock the shared hosted authority and fail-closed defaults", () => {
  const publicSource = fs.readFileSync(
    path.join(
      __dirname,
      "..",
      "src",
      "middleware",
      "publicRegistrationMiddleware.js"
    ),
    "utf8"
  );

  const tenantSource = fs.readFileSync(
    path.join(
      __dirname,
      "..",
      "src",
      "middleware",
      "registrationTenantMiddleware.js"
    ),
    "utf8"
  );

  const envExample = fs.readFileSync(
    path.join(
      __dirname,
      "..",
      ".env.example"
    ),
    "utf8"
  );

  assert.equal(
    publicSource.includes(
      'require("../utils/runtimeSecurity")'
    ),
    true
  );

  assert.equal(
    publicSource.includes(
      'process.env.PUBLIC_REGISTRATION_ENABLED === "true"'
    ),
    true
  );

  assert.equal(
    publicSource.includes("process.env.NODE_ENV"),
    false
  );

  assert.equal(
    publicSource.includes("RAILWAY_ENVIRONMENT_NAME"),
    false
  );

  assert.equal(
    publicSource.includes("RAILWAY_DEPLOYMENT_ID"),
    false
  );

  assert.equal(
    tenantSource.includes(
      "isHostedEnvironment,"
    ),
    true
  );

  const envLines = envExample.split(/\r?\n/);

  assert.equal(
    envLines.filter(
      (line) =>
        line === "PUBLIC_REGISTRATION_ENABLED=false"
    ).length,
    1
  );

  assert.equal(
    envLines.filter(
      (line) =>
        line === "PUBLIC_REGISTRATION_TENANT_ID=pravixoedutech"
    ).length,
    1
  );
});
