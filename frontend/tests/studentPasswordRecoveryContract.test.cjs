const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const studentRoot =
  path.join(
    __dirname,
    "..",
    "app",
    "student"
  );

const readPage = (directory) =>
  fs.readFileSync(
    path.join(
      studentRoot,
      directory,
      "page.tsx"
    ),
    "utf8"
  );

const loginSource =
  readPage("login");

const forgotSource =
  readPage("forgot-password");

const resetSource =
  readPage("reset-password");

const countOccurrence = (
  text,
  value
) =>
  text.split(value).length - 1;

test(
  "student password recovery pages remain client-side auth surfaces",
  () => {
    for (
      const source of
        [
          loginSource,
          forgotSource,
          resetSource,
        ]
    ) {
      assert.ok(
        source.includes(
          '"use client";'
        )
      );
    }

    assert.ok(
      forgotSource.includes(
        'import Link from "next/link"'
      )
    );

    assert.ok(
      resetSource.includes(
        'import Link from "next/link"'
      )
    );
  }
);

test(
  "forgot-password request exposes only login and generic success messaging",
  () => {
    assert.equal(
      countOccurrence(
        forgotSource,
        "/api/auth/forgot-password"
      ),
      1
    );

    assert.match(
      forgotSource,
      /body:\s*JSON\.stringify\(\{\s*login:\s*cleanLogin,\s*\}\)/
    );

    assert.ok(
      forgotSource.includes(
        "If an eligible account exists, password reset instructions have been sent."
      )
    );

    assert.ok(
      forgotSource.includes(
        "response.status === 429"
      )
    );

    const forbidden = [
      "tenantId:",
      "role:",
      "rawToken",
      "resetToken",
      "?token=",
    ];

    for (const anchor of forbidden) {
      assert.equal(
        forgotSource.includes(
          anchor
        ),
        false
      );
    }
  }
);

test(
  "forgot-password page never persists recovery or student-session credentials",
  () => {
    const forbidden = [
      "localStorage",
      "sessionStorage",
      "document.cookie",
      "pravixoStudentToken",
      "pravixoStudentProfile",
      "useRouter(",
      "router.push(",
      "router.replace(",
    ];

    for (const anchor of forbidden) {
      assert.equal(
        forgotSource.includes(
          anchor
        ),
        false
      );
    }

    assert.ok(
      forgotSource.includes(
        'href="/student/login"'
      )
    );
  }
);

test(
  "login page contains one recovery navigation link and no recovery endpoint authority",
  () => {
    assert.equal(
      countOccurrence(
        loginSource,
        'href="/student/forgot-password"'
      ),
      1
    );

    assert.ok(
      loginSource.includes(
        "Forgot password?"
      )
    );

    assert.equal(
      loginSource.includes(
        "/api/auth/forgot-password"
      ),
      false
    );

    assert.equal(
      loginSource.includes(
        "/api/auth/reset-password"
      ),
      false
    );

    assert.ok(
      loginSource.includes(
        "/api/auth/login"
      )
    );

    assert.ok(
      loginSource.includes(
        "pravixoStudentToken"
      )
    );

    assert.ok(
      loginSource.includes(
        "pravixoStudentProfile"
      )
    );
  }
);

test(
  "reset credential is accepted only from one strict fragment token",
  () => {
    assert.equal(
      countOccurrence(
        resetSource,
        "window.location.hash"
      ),
      1
    );

    assert.ok(
      resetSource.includes(
        "new URLSearchParams(fragment)"
      )
    );

    assert.ok(
      resetSource.includes(
        "entries.length !== 1"
      )
    );

    assert.ok(
      resetSource.includes(
        'entries[0][0] !== "token"'
      )
    );

    assert.ok(
      resetSource.includes(
        "/^[A-Za-z0-9_-]{43}$/"
      )
    );

    assert.equal(
      resetSource.includes(
        "useSearchParams"
      ),
      false
    );

    assert.equal(
      resetSource.includes(
        "?token="
      ),
      false
    );
  }
);

test(
  "reset URL is scrubbed to pathname immediately after fragment capture",
  () => {
    assert.match(
      resetSource,
      /window\.history\.replaceState\(\s*null,\s*""\s*,\s*window\.location\.pathname\s*\)/
    );

    assert.equal(
      resetSource.includes(
        "window.location.search"
      ),
      false
    );

    assert.equal(
      resetSource.includes(
        "window.location.href"
      ),
      false
    );

    assert.equal(
      resetSource.includes(
        "window.location.assign"
      ),
      false
    );

    assert.equal(
      resetSource.includes(
        "window.location.replace"
      ),
      false
    );
  }
);

test(
  "reset credential remains in component-memory ref and never browser persistence",
  () => {
    assert.match(
      resetSource,
      /const\s+resetTokenRef\s*=\s*useRef\(""\)/
    );

    const forbidden = [
      "localStorage",
      "sessionStorage",
      "document.cookie",
      "setResetToken",
      "pravixoStudentToken",
      "pravixoStudentProfile",
    ];

    for (const anchor of forbidden) {
      assert.equal(
        resetSource.includes(
          anchor
        ),
        false
      );
    }

    assert.equal(
      /useState(?:<[^>]+>)?\([^)]*token/i
        .test(
          resetSource
        ),
      false
    );
  }
);

test(
  "reset request posts only credential and new password to exact recovery endpoint",
  () => {
    assert.equal(
      countOccurrence(
        resetSource,
        "/api/auth/reset-password"
      ),
      1
    );

    assert.match(
      resetSource,
      /body:\s*JSON\.stringify\(\{\s*token,\s*password,\s*\}\)/
    );

    assert.ok(
      resetSource.includes(
        'method: "POST"'
      )
    );

    const forbidden = [
      "/api/auth/login",
      "tenantId:",
      "role:",
      "router.push(",
      "router.replace(",
      "useRouter(",
    ];

    for (const anchor of forbidden) {
      assert.equal(
        resetSource.includes(
          anchor
        ),
        false
      );
    }
  }
);

test(
  "reset frontend mirrors backend password boundary and confirmation requirement",
  () => {
    assert.ok(
      resetSource.includes(
        "PASSWORD_MIN_CHARACTERS = 8"
      )
    );

    assert.ok(
      resetSource.includes(
        "PASSWORD_MAX_UTF8_BYTES = 72"
      )
    );

    assert.ok(
      resetSource.includes(
        "new TextEncoder().encode(value).length"
      )
    );

    assert.ok(
      resetSource.includes(
        "password.length <"
      )
    );

    assert.ok(
      resetSource.includes(
        "getUtf8ByteLength(password) >"
      )
    );

    assert.ok(
      resetSource.includes(
        "password !== confirmPassword"
      )
    );

    assert.equal(
      countOccurrence(
        resetSource,
        'autoComplete="new-password"'
      ),
      2
    );
  }
);

test(
  "successful reset destroys recovery credential and requires explicit sign-in",
  () => {
    const clearIndex =
      resetSource.lastIndexOf(
        'resetTokenRef.current = ""'
      );

    const completedIndex =
      resetSource.indexOf(
        'setLinkState("completed")'
      );

    assert.ok(
      clearIndex >= 0
    );

    assert.ok(
      completedIndex > clearIndex
    );

    assert.ok(
      resetSource.includes(
        "Password reset successfully. Please sign in again."
      )
    );

    assert.ok(
      resetSource.includes(
        'href="/student/login"'
      )
    );

    assert.equal(
      resetSource.includes(
        "/api/auth/login"
      ),
      false
    );

    assert.equal(
      resetSource.includes(
        "router.push("
      ),
      false
    );

    assert.equal(
      resetSource.includes(
        "router.replace("
      ),
      false
    );
  }
);
