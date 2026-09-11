const test =
  require("node:test");

const assert =
  require("node:assert/strict");

const fs =
  require("node:fs");

const path =
  require("node:path");

const ts =
  require("typescript");

const frontendRoot =
  path.resolve(
    __dirname,
    ".."
  );

const read =
  (relativePath) =>
    fs.readFileSync(
      path.join(
        frontendRoot,
        relativePath
      ),
      "utf8"
    );

const helperPath =
  path.join(
    frontendRoot,
    "lib",
    "secureLogout.ts"
  );

const helperSource =
  fs.readFileSync(
    helperPath,
    "utf8"
  );

const pageContracts = [
  {
    name:
      "student dashboard",

    file:
      "app/student/page.tsx",

    importPath:
      "../../lib/secureLogout",

    tokenExpression:
      "token",

    cleanupMarker:
      "clearStudentSessionStorage();",

    redirectMarker:
      'router.replace("/student/login");',

    forbiddenFailureOperations: [
      "clearStudentSessionStorage();",
      'setToken("");',
      "setProfile(null);",
      'router.replace("/student/login");',
    ],
  },

  {
    name:
      "mock-tests",

    file:
      "app/student/mock-tests/page.tsx",

    importPath:
      "../../../lib/secureLogout",

    tokenExpression:
      "token",

    cleanupMarker:
      "clearStudentSessionStorage();",

    redirectMarker:
      'router.push("/student/login");',

    forbiddenFailureOperations: [
      "clearStudentSessionStorage();",
      'setToken("");',
      "setMockTests([]);",
      "setPaymentPackages([]);",
      'router.push("/student/login");',
    ],
  },

  {
    name:
      "attempt history",

    file:
      "app/student/attempts/page.tsx",

    importPath:
      "../../../lib/secureLogout",

    tokenExpression:
      "token",

    cleanupMarker:
      "clearStudentSessionStorage();",

    redirectMarker:
      'router.push("/student/login");',

    forbiddenFailureOperations: [
      "clearStudentSessionStorage();",
      'setToken("");',
      "setAttempts([]);",
      'router.push("/student/login");',
    ],
  },

  {
    name:
      "result",

    file:
      "app/student/attempts/[attemptId]/result/page.tsx",

    importPath:
      "../../../../../lib/secureLogout",

    tokenExpression:
      "effectiveStudentToken",

    cleanupMarker:
      "clearStudentSessionStorage();",

    redirectMarker:
      'router.push("/student/login");',

    forbiddenFailureOperations: [
      "clearStudentSessionStorage();",
      "setResult(null);",
      'router.push("/student/login");',
    ],
  },

  {
    name:
      "review",

    file:
      "app/student/attempts/[attemptId]/review/page.tsx",

    importPath:
      "../../../../../lib/secureLogout",

    tokenExpression:
      "effectiveStudentToken",

    cleanupMarker:
      "clearStudentSessionStorage();",

    redirectMarker:
      'router.push("/student/login");',

    forbiddenFailureOperations: [
      "clearStudentSessionStorage();",
      "setReview(null);",
      'router.push("/student/login");',
    ],
  },

  {
    name:
      "admin dashboard",

    file:
      "app/admin/dashboard/page.tsx",

    importPath:
      "../../../lib/secureLogout",

    tokenExpression:
      "token",

    cleanupMarker:
      "clearAdminSessionStorage();",

    redirectMarker:
      'router.push("/admin/login");',

    forbiddenFailureOperations: [
      "clearAdminSessionStorage();",
      'setToken("");',
      "setProfile(null);",
      'router.push("/admin/login");',
    ],
  },
];

const assertPageContract =
  (contract) => {
    const source =
      read(
        contract.file
      );

    const expectedImport =
      `import { secureLogout } from "${contract.importPath}";`;

    assert.equal(
      source
        .split(expectedImport)
        .length - 1,
      1,
      `${contract.name}: secureLogout import must exist exactly once`
    );

    const expectedCall =
      `await secureLogout(${contract.tokenExpression});`;

    assert.equal(
      source
        .split(expectedCall)
        .length - 1,
      1,
      `${contract.name}: secureLogout call must exist exactly once`
    );

    const handlerStart =
      source.indexOf(
        "const handleLogout = async () => {"
      );

    assert.notEqual(
      handlerStart,
      -1,
      `${contract.name}: logout handler must be async`
    );

    const callIndex =
      source.indexOf(
        expectedCall,
        handlerStart
      );

    const gateIndex =
      source.indexOf(
        "if (!logoutResult.shouldClearLocalSession) {",
        callIndex
      );

    const cleanupIndex =
      source.indexOf(
        contract.cleanupMarker,
        gateIndex
      );

    const redirectIndex =
      source.indexOf(
        contract.redirectMarker,
        cleanupIndex
      );

    assert.ok(
      callIndex >
        handlerStart,
      `${contract.name}: secureLogout must execute inside logout handler`
    );

    assert.ok(
      gateIndex >
        callIndex,
      `${contract.name}: cleanup gate must follow secureLogout`
    );

    assert.ok(
      cleanupIndex >
        gateIndex,
      `${contract.name}: local cleanup must occur after fail-closed gate`
    );

    assert.ok(
      redirectIndex >
        cleanupIndex,
      `${contract.name}: redirect must occur after local cleanup`
    );

    const failureBranch =
      source.slice(
        gateIndex,
        cleanupIndex
      );

    assert.match(
      failureBranch,
      /Secure logout could not be confirmed\./,
      `${contract.name}: unconfirmed logout must show retryable failure`
    );

    assert.match(
      failureBranch,
      /\breturn;/,
      `${contract.name}: unconfirmed logout must return before cleanup`
    );

    for (
      const forbidden of
        contract.forbiddenFailureOperations
    ) {
      assert.equal(
        failureBranch.includes(
          forbidden
        ),
        false,
        `${contract.name}: failure branch must not perform ${forbidden}`
      );
    }

    assert.doesNotMatch(
      source.slice(
        handlerStart,
        redirectIndex +
          contract.redirectMarker.length
      ),
      /\/api\/auth\/(?:admin-)?logout/,
      `${contract.name}: page must not bypass shared helper with direct logout endpoint`
    );
  };

test(
  "secureLogout helper keeps the network/session authority boundary narrow",
  {
    concurrency:
      false,
  },
  () => {
    assert.match(
      helperSource,
      /NEXT_PUBLIC_API_BASE_URL/
    );

    assert.match(
      helperSource,
      /NEXT_PUBLIC_API_URL/
    );

    assert.match(
      helperSource,
      /http:\/\/localhost:5000/
    );

    assert.equal(
      (
        helperSource.match(
          /\/api\/auth\/logout/g
        ) || []
      ).length,
      1
    );

    assert.match(
      helperSource,
      /method:\s*"POST"/
    );

    assert.match(
      helperSource,
      /Authorization:\s*`Bearer \$\{token\}`/
    );

    assert.match(
      helperSource,
      /cache:\s*"no-store"/
    );

    assert.doesNotMatch(
      helperSource,
      /localStorage|sessionStorage/
    );

    assert.doesNotMatch(
      helperSource,
      /console\./
    );

    assert.doesNotMatch(
      helperSource,
      /\.json\(\)|JSON\.parse/
    );
  }
);

test(
  "secureLogout runtime behavior allows cleanup only for no-token, 2xx and 401",
  {
    concurrency:
      false,
  },
  async () => {
    const compiled =
      ts.transpileModule(
        helperSource,
        {
          compilerOptions: {
            module:
              ts.ModuleKind.CommonJS,

            target:
              ts.ScriptTarget.ES2020,
          },
        }
      ).outputText;

    const originalFetch =
      global.fetch;

    const originalBase =
      process.env
        .NEXT_PUBLIC_API_BASE_URL;

    const originalLegacy =
      process.env
        .NEXT_PUBLIC_API_URL;

    const restore =
      () => {
        global.fetch =
          originalFetch;

        if (
          originalBase ===
            undefined
        ) {
          delete process.env
            .NEXT_PUBLIC_API_BASE_URL;
        }
        else {
          process.env
            .NEXT_PUBLIC_API_BASE_URL =
            originalBase;
        }

        if (
          originalLegacy ===
            undefined
        ) {
          delete process.env
            .NEXT_PUBLIC_API_URL;
        }
        else {
          process.env
            .NEXT_PUBLIC_API_URL =
            originalLegacy;
        }
      };

    try {
      process.env
        .NEXT_PUBLIC_API_BASE_URL =
          "https://primary.example.test";

      process.env
        .NEXT_PUBLIC_API_URL =
          "https://legacy.example.test";

      const moduleObject = {
        exports: {},
      };

      const evaluator =
        new Function(
          "exports",
          "require",
          "module",
          "__filename",
          "__dirname",
          compiled
        );

      evaluator(
        moduleObject.exports,
        require,
        moduleObject,
        helperPath,
        path.dirname(
          helperPath
        )
      );

      const {
        secureLogout,
      } =
        moduleObject.exports;

      assert.equal(
        typeof secureLogout,
        "function"
      );

      let fetchCount = 0;

      global.fetch =
        async () => {
          fetchCount += 1;

          throw new Error(
            "fetch must not run for empty token"
          );
        };

      assert.deepEqual(
        await secureLogout(
          "   "
        ),
        {
          shouldClearLocalSession:
            true,

          kind:
            "no_token",

          status:
            null,
        }
      );

      assert.equal(
        fetchCount,
        0
      );

      let observedUrl =
        null;

      let observedOptions =
        null;

      global.fetch =
        async (
          url,
          options
        ) => {
          observedUrl =
            String(url);

          observedOptions =
            options;

          return {
            ok:
              true,

            status:
              204,
          };
        };

      assert.deepEqual(
        await secureLogout(
          " bearer-value "
        ),
        {
          shouldClearLocalSession:
            true,

          kind:
            "server_revoked",

          status:
            204,
        }
      );

      assert.equal(
        observedUrl,
        "https://primary.example.test/api/auth/logout"
      );

      assert.equal(
        observedOptions.method,
        "POST"
      );

      assert.equal(
        observedOptions
          .headers
          .Authorization,
        "Bearer bearer-value"
      );

      assert.equal(
        observedOptions.cache,
        "no-store"
      );

      global.fetch =
        async () => ({
          ok:
            false,

          status:
            401,
        });

      assert.deepEqual(
        await secureLogout(
          "token"
        ),
        {
          shouldClearLocalSession:
            true,

          kind:
            "session_invalid",

          status:
            401,
        }
      );

      for (
        const status of
          [
            400,
            403,
            404,
            409,
            429,
            500,
            503,
          ]
      ) {
        global.fetch =
          async () => ({
            ok:
              false,

            status,
          });

        assert.deepEqual(
          await secureLogout(
            "token"
          ),
          {
            shouldClearLocalSession:
              false,

            kind:
              "unconfirmed",

            status,
          }
        );
      }

      global.fetch =
        async () => {
          throw new TypeError(
            "controlled network failure"
          );
        };

      assert.deepEqual(
        await secureLogout(
          "token"
        ),
        {
          shouldClearLocalSession:
            false,

          kind:
            "unconfirmed",

          status:
            null,
        }
      );
    }
    finally {
      restore();
    }
  }
);

for (
  const contract of
    pageContracts
) {
  test(
    `${contract.name} uses fail-closed shared secure logout before local cleanup`,
    () => {
      assertPageContract(
        contract
      );
    }
  );
}

test(
  "StudentPortalShell and timed attempt remain outside logout implementation scope",
  () => {
    const shell =
      read(
        "components/student/StudentPortalShell.tsx"
      );

    const timedAttempt =
      read(
        "app/student/attempts/[attemptId]/page.tsx"
      );

    assert.doesNotMatch(
      shell,
      /secureLogout/
    );

    assert.doesNotMatch(
      timedAttempt,
      /secureLogout/
    );
  }
);