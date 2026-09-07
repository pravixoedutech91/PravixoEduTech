const test =
  require("node:test");

const assert =
  require("node:assert/strict");

const fs =
  require("node:fs");

const readSource =
  (file) =>
    fs
      .readFileSync(
        file,
        "utf8"
      )
      .replace(
        /\r\n/g,
        "\n"
      );

const registerSource =
  readSource(
    "./app/student/register/page.tsx"
  );

const loginSource =
  readSource(
    "./app/student/login/page.tsx"
  );

const verifySource =
  readSource(
    "./app/student/verify-email/page.tsx"
  );

const count =
  (
    source,
    needle
  ) =>
    source
      .split(
        needle
      )
      .length - 1;

test(
  "registration requires verification and never creates an authenticated browser session",
  () => {
    assert.equal(
      count(
        registerSource,
        "/api/auth/register"
      ),
      1
    );

    assert.match(
      registerSource,
      /EMAIL_VERIFICATION_REQUIRED/
    );

    assert.match(
      registerSource,
      /emailVerificationRequired/
    );

    assert.match(
      registerSource,
      /verificationEmailSent/
    );

    assert.equal(
      count(
        registerSource,
        "pravixoStudentToken"
      ),
      0
    );

    assert.equal(
      count(
        registerSource,
        "pravixoStudentProfile"
      ),
      0
    );

    assert.equal(
      count(
        registerSource,
        "localStorage"
      ),
      0
    );

    assert.equal(
      count(
        registerSource,
        "sessionStorage"
      ),
      0
    );

    assert.equal(
      count(
        registerSource,
        'router.replace("/student")'
      ),
      0
    );
  }
);

test(
  "registration resend preserves generic acknowledgement without inferring delivery",
  () => {
    assert.equal(
      count(
        registerSource,
        "/api/auth/resend-email-verification"
      ),
      1
    );

    assert.match(
      registerSource,
      /GENERIC_RESEND_MESSAGE/
    );

    assert.doesNotMatch(
      registerSource,
      /setVerificationEmailSent\(true\)/
    );

    assert.match(
      registerSource,
      /registrationEmail/
    );
  }
);

test(
  "unverified login handles verification-required before token validation and session writes",
  () => {
    const verificationBranch =
      loginSource.indexOf(
        "response.status === 403"
      );

    const codeCheck =
      loginSource.indexOf(
        "EMAIL_VERIFICATION_REQUIRED_CODE"
      );

    const genericFailure =
      loginSource.indexOf(
        "if (!response.ok || !result.success)"
      );

    const tokenCheck =
      loginSource.indexOf(
        "if (!result.token)"
      );

    const sessionWrite =
      loginSource.indexOf(
        "window.localStorage.setItem"
      );

    assert.ok(
      verificationBranch >= 0
    );

    assert.ok(
      codeCheck >= 0
    );

    assert.ok(
      genericFailure >= 0
    );

    assert.ok(
      tokenCheck >= 0
    );

    assert.ok(
      sessionWrite >= 0
    );

    assert.ok(
      verificationBranch <
        genericFailure
    );

    assert.ok(
      genericFailure <
        tokenCheck
    );

    assert.ok(
      tokenCheck <
        sessionWrite
    );

    assert.match(
      loginSource,
      /setPassword\(""\)/
    );
  }
);

test(
  "verified login retains the existing authenticated session authority",
  () => {
    assert.equal(
      count(
        loginSource,
        "window.localStorage.setItem"
      ),
      2
    );

    assert.equal(
      count(
        loginSource,
        "pravixoStudentToken"
      ),
      1
    );

    assert.equal(
      count(
        loginSource,
        "pravixoStudentProfile"
      ),
      1
    );

    assert.equal(
      count(
        loginSource,
        'router.push("/student")'
      ),
      1
    );
  }
);

test(
  "login resend preserves enumeration-resistant generic semantics",
  () => {
    assert.equal(
      count(
        loginSource,
        "/api/auth/resend-email-verification"
      ),
      1
    );

    assert.match(
      loginSource,
      /verificationRequiredLogin/
    );

    assert.match(
      loginSource,
      /GENERIC_RESEND_MESSAGE/
    );

    assert.doesNotMatch(
      loginSource,
      /setVerificationEmailSent/
    );

    assert.equal(
      count(
        loginSource,
        "sessionStorage"
      ),
      0
    );
  }
);

test(
  "verification credential is accepted only from one strict fragment token and URL is scrubbed first",
  () => {
    assert.match(
      verifySource,
      /\/\^\[A-Za-z0-9_-\]\{43\}\$\//
    );

    assert.match(
      verifySource,
      /entries\.length !== 1/
    );

    assert.match(
      verifySource,
      /entries\[0\]\[0\] !== "token"/
    );

    assert.equal(
      count(
        verifySource,
        "window.location.hash"
      ),
      1
    );

    assert.equal(
      count(
        verifySource,
        "window.history.replaceState"
      ),
      1
    );

    const capture =
      verifySource.indexOf(
        "window.location.hash"
      );

    const scrub =
      verifySource.indexOf(
        "window.history.replaceState"
      );

    const memoryStore =
      verifySource.indexOf(
        [
          "verificationTokenRef.current =",
          "            capturedToken;"
        ].join(
          "\n"
        )
      );

    const verifyCall =
      verifySource.indexOf(
        "void verifyCapturedToken();"
      );

    assert.ok(
      capture >= 0
    );

    assert.ok(
      scrub > capture
    );

    assert.ok(
      memoryStore > scrub
    );

    assert.ok(
      verifyCall > memoryStore
    );
  }
);

test(
  "verification credential remains memory-only and is destroyed after terminal outcomes",
  () => {
    assert.equal(
      count(
        verifySource,
        "/api/auth/verify-email"
      ),
      1
    );

    assert.equal(
      count(
        verifySource,
        "localStorage"
      ),
      0
    );

    assert.equal(
      count(
        verifySource,
        "sessionStorage"
      ),
      0
    );

    assert.equal(
      count(
        verifySource,
        "document.cookie"
      ),
      0
    );

    assert.equal(
      count(
        verifySource,
        "window.location.search"
      ),
      0
    );

    assert.equal(
      count(
        verifySource,
        "useSearchParams"
      ),
      0
    );

    assert.ok(
      count(
        verifySource,
        'verificationTokenRef.current = "";'
      ) >= 3
    );

    assert.match(
      verifySource,
      /response\.status === 400/
    );

    assert.match(
      verifySource,
      /Retry Verification/
    );
  }
);

test(
  "email verification never auto-authenticates the student",
  () => {
    const forbidden = [
      "/api/auth/login",
      "pravixoStudentToken",
      "pravixoStudentProfile",
      "localStorage.setItem",
      "router.push(",
      "router.replace(",
      "window.location.assign",
    ];

    for (
      const needle of forbidden
    ) {
      assert.equal(
        verifySource.includes(
          needle
        ),
        false,
        "verify page must not contain " +
          needle
      );
    }

    assert.match(
      verifySource,
      /href="\/student\/login"/
    );

    assert.match(
      verifySource,
      /Verification does not sign you in/
    );
  }
);