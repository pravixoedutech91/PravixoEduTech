const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const backendRoot = path.resolve(__dirname, "..");

const modelPath = path.join(
  backendRoot,
  "src",
  "models",
  "SitePromotion.js"
);

const controllerPath = path.join(
  backendRoot,
  "src",
  "controllers",
  "sitePromotionController.js"
);

const routesPath = path.join(
  backendRoot,
  "src",
  "routes",
  "sitePromotionRoutes.js"
);

const normalize = (value) =>
  value.replace(/\r\n/g, "\n");

const modelSource = normalize(
  fs.readFileSync(modelPath, "utf8")
);

const controllerSource = normalize(
  fs.readFileSync(controllerPath, "utf8")
);

const routesSource = normalize(
  fs.readFileSync(routesPath, "utf8")
);

const extractAsyncController = (
  source,
  functionName
) => {
  const marker =
    `const ${functionName} = async (req, res) => {`;

  const start = source.indexOf(marker);

  assert.notEqual(
    start,
    -1,
    `${functionName} controller must exist`
  );

  const afterStart = source.slice(
    start + marker.length
  );

  const nextControllerMatch =
    /\nconst [A-Za-z0-9_]+ = async \(req, res\) => \{/.exec(
      afterStart
    );

  const end = nextControllerMatch
    ? start +
      marker.length +
      nextControllerMatch.index
    : source.length;

  return source.slice(start, end);
};

test(
  "SitePromotion model supports the two student dashboard placements",
  () => {
    assert.match(
      modelSource,
      /["']student_dashboard_primary["']/,
      "SitePromotion placement enum must allow student_dashboard_primary"
    );

    assert.match(
      modelSource,
      /["']student_dashboard_secondary["']/,
      "SitePromotion placement enum must allow student_dashboard_secondary"
    );

    assert.equal(
      (
        modelSource.match(
          /["']student_dashboard_primary["']/g
        ) || []
      ).length,
      1,
      "student_dashboard_primary must appear exactly once in the model placement contract"
    );

    assert.equal(
      (
        modelSource.match(
          /["']student_dashboard_secondary["']/g
        ) || []
      ).length,
      1,
      "student_dashboard_secondary must appear exactly once in the model placement contract"
    );
  }
);

test(
  "public active promotion route remains separate and does not acquire student authentication",
  () => {
    const routeMatch = routesSource.match(
      /router\.get\(\s*["']\/active["']\s*,([\s\S]*?)\);/
    );

    assert.ok(
      routeMatch,
      "GET /active promotion route must remain present"
    );

    const middlewareBlock = routeMatch[1];

    assert.match(
      middlewareBlock,
      /\bgetActivePromotion\b/,
      "public /active must continue to invoke getActivePromotion"
    );

    assert.doesNotMatch(
      middlewareBlock,
      /\bprotect\b/,
      "public /active must not become authenticated"
    );

    assert.doesNotMatch(
      middlewareBlock,
      /\bauthorize\s*\(/,
      "public /active must not gain a role gate"
    );

    assert.doesNotMatch(
      middlewareBlock,
      /\bgetActiveStudentPromotion\b/,
      "public /active must not invoke the student promotion controller"
    );
  }
);

test(
  "student active promotion route is protected and student-only",
  () => {
    assert.match(
      routesSource,
      /\bgetActiveStudentPromotion\b/,
      "student promotion controller must be imported by the route file"
    );

    const routeMatch = routesSource.match(
      /router\.get\(\s*["']\/student\/active["']\s*,([\s\S]*?)\);/
    );

    assert.ok(
      routeMatch,
      "GET /student/active route must exist"
    );

    const middlewareBlock = routeMatch[1];

    assert.match(
      middlewareBlock,
      /\bprotect\b/,
      "student promotion route must use protect"
    );

    assert.match(
      middlewareBlock,
      /authorize\s*\(\s*["']student["']\s*\)/,
      "student promotion route must authorize only student role"
    );

    assert.match(
      middlewareBlock,
      /\bgetActiveStudentPromotion\b/,
      "student promotion route must invoke getActiveStudentPromotion"
    );

    const protectIndex =
      middlewareBlock.indexOf("protect");

    const authorizeIndex =
      middlewareBlock.indexOf("authorize");

    const controllerIndex =
      middlewareBlock.indexOf(
        "getActiveStudentPromotion"
      );

    assert.ok(
      protectIndex >= 0 &&
        authorizeIndex > protectIndex &&
        controllerIndex > authorizeIndex,
      "student promotion route order must be protect -> authorize(student) -> controller"
    );
  }
);

test(
  "student promotion placements are isolated from public promotion placements",
  () => {
    assert.match(
      controllerSource,
      /const\s+PUBLIC_PROMOTION_PLACEMENTS\s*=\s*\[[\s\S]*?\];/,
      "controller must define a public promotion placement allowlist"
    );

    assert.match(
      controllerSource,
      /const\s+STUDENT_PROMOTION_PLACEMENTS\s*=\s*\[[\s\S]*?["']student_dashboard_primary["'][\s\S]*?["']student_dashboard_secondary["'][\s\S]*?\];/,
      "controller must define the two student dashboard placements"
    );

    const publicBlockMatch =
      controllerSource.match(
        /const\s+PUBLIC_PROMOTION_PLACEMENTS\s*=\s*(\[[\s\S]*?\]);/
      );

    assert.ok(
      publicBlockMatch,
      "public placement block must be extractable"
    );

    assert.doesNotMatch(
      publicBlockMatch[1],
      /student_dashboard_primary|student_dashboard_secondary/,
      "student-only placements must not be accepted by the public promotion endpoint"
    );

    const activePublicSource =
      extractAsyncController(
        controllerSource,
        "getActivePromotion"
      );

    assert.match(
      activePublicSource,
      /PUBLIC_PROMOTION_PLACEMENTS\.includes\s*\(\s*placement\s*\)/,
      "public active controller must validate only against public placements"
    );
  }
);

test(
  "student promotion controller derives organization authority only from authenticated user context",
  () => {
    const studentSource =
      extractAsyncController(
        controllerSource,
        "getActiveStudentPromotion"
      );

    assert.match(
      studentSource,
      /req\.user\?\.tenantId/,
      "student promotion tenant must come from authenticated req.user"
    );

    assert.doesNotMatch(
      studentSource,
      /req\.(?:body|query)(?:\?\.|\.)\s*tenantId\b|req\.(?:body|query)\s*\[\s*["']tenantId["']\s*\]/,
      "student promotion controller must not accept tenant authority from body or query"
    );

    assert.match(
      studentSource,
      /if\s*\(\s*!tenantId\s*\)[\s\S]*?status\s*\(\s*403\s*\)/,
      "missing authenticated organization context must fail closed with 403"
    );
  }
);

test(
  "student promotion controller validates placement and performs tenant-scoped active time-window query",
  () => {
    const studentSource =
      extractAsyncController(
        controllerSource,
        "getActiveStudentPromotion"
      );

    assert.match(
      studentSource,
      /STUDENT_PROMOTION_PLACEMENTS\.includes\s*\(\s*placement\s*\)/,
      "student controller must validate placement against student-only allowlist"
    );

    assert.match(
      studentSource,
      /status\s*\(\s*400\s*\)/,
      "invalid student placement must fail with HTTP 400"
    );

    assert.match(
      studentSource,
      /SitePromotion\.findOne\s*\(\s*\{[\s\S]*?\btenantId\s*,[\s\S]*?\bplacement\s*,[\s\S]*?status\s*:\s*["']active["']/,
      "promotion query must bind tenantId, placement and active status"
    );

    assert.match(
      studentSource,
      /startAt\s*:\s*null[\s\S]*?startAt\s*:\s*\{\s*\$lte\s*:\s*now\s*\}/,
      "promotion query must reject not-yet-started promotions"
    );

    assert.match(
      studentSource,
      /endAt\s*:\s*null[\s\S]*?endAt\s*:\s*\{\s*\$gte\s*:\s*now\s*\}/,
      "promotion query must reject expired promotions"
    );
  }
);

test(
  "student promotion response projection exposes only display-safe promotion fields",
  () => {
    const studentSource =
      extractAsyncController(
        controllerSource,
        "getActiveStudentPromotion"
      );

    const selectMatch = studentSource.match(
      /\.select\s*\(\s*([\s\S]*?)\s*\)\s*;/
    );

    assert.ok(
      selectMatch,
      "student promotion query must use an explicit projection"
    );

    const projection = selectMatch[1];

    for (const field of [
      "placement",
      "title",
      "subtitle",
      "badgeText",
      "imageUrl",
      "ctaLabel",
      "ctaUrl",
      "priority",
      "startAt",
      "endAt",
      "updatedAt",
    ]) {
      assert.match(
        projection,
        new RegExp(`\\b${field}\\b`),
        `student promotion projection must include ${field}`
      );
    }

    assert.doesNotMatch(
      projection,
      /\btenantId\b|\bcreatedBy\b|\bupdatedBy\b/,
      "student promotion projection must not expose tenant or admin audit authority fields"
    );
  }
);

test(
  "student promotion controller is exported",
  () => {
    assert.match(
      controllerSource,
      /module\.exports\s*=\s*\{[\s\S]*?\bgetActiveStudentPromotion\b[\s\S]*?\};/,
      "sitePromotionController must export getActiveStudentPromotion"
    );
  }
);