const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const jwt = require("jsonwebtoken");

const User = require("../src/models/User");

const {
  protect,
} = require("../src/middleware/authMiddleware");

const makeResponse = () => ({
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

const runProtect = async ({
  decodedSessionId,
  user,
}) => {
  const originalVerify = jwt.verify;
  const originalFindById = User.findById;

  try {
    jwt.verify = () => ({
      id: "protect-contract-user",
      sessionId: decodedSessionId,
    });

    User.findById = async () => user;

    const req = {
      headers: {
        authorization: "Bearer protect-contract-token",
      },
    };

    const res = makeResponse();

    let nextCalls = 0;

    await protect(
      req,
      res,
      () => {
        nextCalls += 1;
      }
    );

    return {
      req,
      res,
      nextCalls,
    };
  } finally {
    jwt.verify = originalVerify;
    User.findById = originalFindById;
  }
};

test("protect keeps session validation before student email verification authority", () => {
  const middlewarePath = path.join(
    __dirname,
    "..",
    "src",
    "middleware",
    "authMiddleware.js"
  );

  const source = fs.readFileSync(
    middlewarePath,
    "utf8"
  );

  const start = source.indexOf(
    "const protect = async"
  );

  const end = source.indexOf(
    "// Role Authorization",
    start
  );

  assert.ok(start >= 0);
  assert.ok(end > start);

  const region = source.slice(
    start,
    end
  );

  const jwtVerify = region.indexOf(
    "jwt.verify("
  );

  const lookup = region.indexOf(
    "User.findById("
  );

  const decodedSession = region.indexOf(
    "decoded.sessionId"
  );

  const activeSession = region.indexOf(
    "user.activeSessionId"
  );

  const verificationRole = region.indexOf(
    'user.role === "student"'
  );

  const verificationState = region.indexOf(
    "user.isEmailVerified !== true"
  );

  const reqUser = region.indexOf(
    "req.user = user"
  );

  const next = region.indexOf(
    "next()"
  );

  assert.ok(jwtVerify >= 0);
  assert.ok(lookup > jwtVerify);
  assert.ok(decodedSession > lookup);
  assert.ok(activeSession > lookup);
  assert.ok(
    verificationRole > decodedSession
  );
  assert.ok(
    verificationRole > activeSession
  );
  assert.ok(
    verificationState > verificationRole
  );
  assert.ok(reqUser > verificationState);
  assert.ok(next > reqUser);

  assert.equal(
    (
      region.match(
        /\bisEmailVerified\b/g
      ) || []
    ).length,
    1
  );

  assert.equal(
    (
      region.match(
        /\bisActive\b/g
      ) || []
    ).length,
    0
  );

  assert.ok(
    source.includes(
      '"EMAIL_VERIFICATION_REQUIRED"'
    )
  );

  assert.ok(
    source.includes(
      '"Please verify your email before continuing."'
    )
  );
});

test("protect rejects stale student session before exposing verification state", async () => {
  const user = {
    role: "student",
    isEmailVerified: false,
    activeSessionId: "current-session",
  };

  const result = await runProtect({
    decodedSessionId: "stale-session",
    user,
  });

  assert.equal(
    result.res.statusCode,
    401
  );

  assert.deepEqual(
    result.res.body,
    {
      success: false,
      message:
        "Session expired. Logged in from another device.",
    }
  );

  assert.equal(result.nextCalls, 0);

  assert.equal(
    Object.prototype.hasOwnProperty.call(
      result.req,
      "user"
    ),
    false
  );

  assert.equal(
    Object.prototype.hasOwnProperty.call(
      result.res.body,
      "code"
    ),
    false
  );
});

test("protect blocks valid-session unverified student before req.user and next", async () => {
  const user = {
    role: "student",
    isEmailVerified: false,
    activeSessionId: "valid-session",
  };

  const result = await runProtect({
    decodedSessionId: "valid-session",
    user,
  });

  assert.equal(
    result.res.statusCode,
    403
  );

  assert.deepEqual(
    result.res.body,
    {
      success: false,
      code: "EMAIL_VERIFICATION_REQUIRED",
      message:
        "Please verify your email before continuing.",
    }
  );

  assert.equal(result.nextCalls, 0);

  assert.equal(
    Object.prototype.hasOwnProperty.call(
      result.req,
      "user"
    ),
    false
  );
});

test("protect fails closed when student verification state is missing", async () => {
  const user = {
    role: "student",
    activeSessionId: "legacy-session",
  };

  const result = await runProtect({
    decodedSessionId: "legacy-session",
    user,
  });

  assert.equal(
    result.res.statusCode,
    403
  );

  assert.equal(
    result.res.body.code,
    "EMAIL_VERIFICATION_REQUIRED"
  );

  assert.equal(result.nextCalls, 0);

  assert.equal(
    Object.prototype.hasOwnProperty.call(
      result.req,
      "user"
    ),
    false
  );
});

test("protect allows verified student with valid session", async () => {
  const user = {
    role: "student",
    isEmailVerified: true,
    activeSessionId: "verified-session",
  };

  const result = await runProtect({
    decodedSessionId: "verified-session",
    user,
  });

  assert.equal(result.nextCalls, 1);
  assert.equal(result.req.user, user);
  assert.equal(result.res.body, undefined);
});

test("protect keeps non-student role outside student email verification gate", async () => {
  const user = {
    role: "tenant_admin",
    isEmailVerified: false,
    activeSessionId: "admin-session",
  };

  const result = await runProtect({
    decodedSessionId: "admin-session",
    user,
  });

  assert.equal(result.nextCalls, 1);
  assert.equal(result.req.user, user);
  assert.equal(result.res.body, undefined);
});
