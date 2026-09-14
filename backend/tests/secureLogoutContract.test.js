const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const backendRoot = path.resolve(__dirname, "..");

const middlewarePath = path.join(
  backendRoot,
  "src",
  "middleware",
  "authMiddleware.js"
);

const controllerPath = path.join(
  backendRoot,
  "src",
  "controllers",
  "authController.js"
);

const routesPath = path.join(
  backendRoot,
  "src",
  "routes",
  "authRoutes.js"
);

const middlewareSource = fs.readFileSync(
  middlewarePath,
  "utf8"
);

const controllerSource = fs.readFileSync(
  controllerPath,
  "utf8"
);

const routesSource = fs.readFileSync(
  routesPath,
  "utf8"
);

const normalize = (value) =>
  value.replace(/\r\n/g, "\n");

const normalizedMiddleware =
  normalize(middlewareSource);

const normalizedController =
  normalize(controllerSource);

const normalizedRoutes =
  normalize(routesSource);

const extractAsyncController = (
  source,
  functionName
) => {
  const marker =
    `const ${functionName} = async (req, res) => {`;

  const start =
    source.indexOf(marker);

  assert.notEqual(
    start,
    -1,
    `${functionName} controller must exist`
  );

  const afterStart =
    source.slice(
      start + marker.length
    );

  const nextControllerMatch =
    /\nconst [A-Za-z0-9_]+ = async \(req, res\) => \{/.exec(
      afterStart
    );

  const end =
    nextControllerMatch
      ? start +
        marker.length +
        nextControllerMatch.index
      : source.length;

  return source.slice(
    start,
    end
  );
};

test(
  "logout route is one shared protected POST endpoint without a role gate",
  () => {
    assert.match(
      normalizedRoutes,
      /\blogoutUser\b/,
      "authRoutes must import logoutUser"
    );

    const routeMatch =
      normalizedRoutes.match(
        /router\.post\(\s*["']\/logout["']\s*,([\s\S]*?)\);/
      );

    assert.ok(
      routeMatch,
      "POST /logout route must exist"
    );

    const middlewareBlock =
      routeMatch[1];

    assert.match(
      middlewareBlock,
      /\bprotect\b/,
      "logout route must use protect"
    );

    assert.match(
      middlewareBlock,
      /\blogoutUser\b/,
      "logout route must invoke logoutUser"
    );

    assert.doesNotMatch(
      middlewareBlock,
      /\bauthorize\s*\(/,
      "logout must be shared by authenticated students and admins"
    );
  }
);

test(
  "protect exposes only the already-validated JWT session id to downstream logout code",
  () => {
    const sessionAuthorityIndex =
      normalizedMiddleware.indexOf(
        "decoded.sessionId !== user.activeSessionId"
      );

    const verificationGateIndex =
      normalizedMiddleware.indexOf(
        'user.role === "student"'
      );

    const trustedContextMatch =
      normalizedMiddleware.match(
        /req\.authSessionId\s*=\s*decoded\.sessionId\s*;/
      );

    assert.ok(
      sessionAuthorityIndex >= 0,
      "existing one-device session authority must remain present"
    );

    assert.ok(
      verificationGateIndex >= 0,
      "existing student verification gate must remain present"
    );

    assert.ok(
      trustedContextMatch,
      "protect must expose decoded.sessionId as req.authSessionId"
    );

    const trustedContextIndex =
      trustedContextMatch.index;

    const nextIndex =
      normalizedMiddleware.indexOf(
        "next()"
      );

    assert.ok(
      trustedContextIndex >
        sessionAuthorityIndex,
      "trusted logout session context must be assigned only after session authority is proven"
    );

    assert.ok(
      trustedContextIndex >
        verificationGateIndex,
      "trusted session context must remain downstream of the student verification gate"
    );

    assert.ok(
      nextIndex >
        trustedContextIndex,
      "trusted session context must be assigned before protect calls next()"
    );

    assert.equal(
      (
        normalizedMiddleware.match(
          /req\.authSessionId\s*=\s*decoded\.sessionId\s*;/g
        ) || []
      ).length,
      1,
      "protect must expose the trusted session id exactly once"
    );
  }
);

test(
  "logout revocation is atomic and bound to the authenticated user plus exact authenticated session",
  () => {
    const logoutSource =
      extractAsyncController(
        normalizedController,
        "logoutUser"
      );

    assert.match(
      logoutSource,
      /User\.findOneAndUpdate\s*\(/,
      "logout must use one atomic conditional User.findOneAndUpdate"
    );

    assert.match(
      logoutSource,
      /_id\s*:\s*req\.user\._id/,
      "logout filter must use authenticated req.user._id"
    );

    assert.match(
      logoutSource,
      /activeSessionId\s*:\s*req\.authSessionId/,
      "logout filter must bind to the exact JWT-authenticated session"
    );

    assert.doesNotMatch(
      logoutSource,
      /req\.body\s*\.\s*(?:sessionId|activeSessionId|userId|id)\b/,
      "logout must never accept session or user authority from req.body"
    );

    assert.doesNotMatch(
      logoutSource,
      /req\.query\s*\.\s*(?:sessionId|activeSessionId|userId|id)\b/,
      "logout must never accept session or user authority from req.query"
    );
  }
);

test(
  "logout clears only active session state and preserves login/account history",
  () => {
    const logoutSource =
      extractAsyncController(
        normalizedController,
        "logoutUser"
      );

    assert.match(
      logoutSource,
      /\$set\s*:\s*\{[\s\S]*?activeSessionId\s*:\s*["']["'][\s\S]*?lastLoginDevice\s*:\s*["']["'][\s\S]*?\}/,
      "logout must clear activeSessionId and lastLoginDevice"
    );

    assert.doesNotMatch(
      logoutSource,
      /lastLoginAt\s*:/,
      "logout must preserve lastLoginAt"
    );

    assert.doesNotMatch(
      logoutSource,
      /\b(?:password|email|mobile|name|tenantId|role|isActive|isEmailVerified)\s*:/,
      "logout must not mutate identity, role, tenant, activation, verification or password fields"
    );

    assert.doesNotMatch(
      logoutSource,
      /\.save\s*\(/,
      "logout must not use stale req.user.save() session revocation"
    );
  }
);

test(
  "logout returns a generic success response without JWT or session material",
  () => {
    const logoutSource =
      extractAsyncController(
        normalizedController,
        "logoutUser"
      );

    assert.match(
      logoutSource,
      /res\.status\s*\(\s*200\s*\)\.json\s*\(\s*\{[\s\S]*?success\s*:\s*true[\s\S]*?message\s*:/,
      "logout must return a generic HTTP 200 success response"
    );

    const responseMatch =
      logoutSource.match(
        /res\.status\s*\(\s*200\s*\)\.json\s*\(\s*(\{[\s\S]*?\})\s*\)/
      );

    assert.ok(
      responseMatch,
      "logout 200 response body must be present"
    );

    const responseBody =
      responseMatch[1];

    assert.doesNotMatch(
      responseBody,
      /\btoken\b|sessionId|activeSessionId|authSessionId/i,
      "logout response must expose no token or session identifier"
    );
  }
);

test(
  "logoutUser is exported from authController",
  () => {
    assert.match(
      normalizedController,
      /module\.exports\s*=\s*\{[\s\S]*?\blogoutUser\b[\s\S]*?\};/,
      "authController must export logoutUser"
    );
  }
);