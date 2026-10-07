const test =
  require("node:test");

const assert =
  require("node:assert/strict");

const fs =
  require("node:fs");

const {
  normalizeSingleEmailAddress,
} = require(
  "../src/utils/emailAddressNormalization"
);


test(
  "shared account email normalizer exposes only the intended provider-neutral API",
  () => {

    const shared =
      require(
        "../src/utils/emailAddressNormalization"
      );

    assert.deepEqual(
      Object.keys(shared),
      [
        "normalizeSingleEmailAddress",
      ]
    );

    assert.equal(
      typeof normalizeSingleEmailAddress,
      "function"
    );


    const moduleSource =
      fs.readFileSync(
        require.resolve(
          "../src/utils/emailAddressNormalization"
        ),
        "utf8"
      );


    const forbiddenProviderAuthority = [
      "POSTMARK_",
      "Postmark",
      "postmarkapp.com",
      "X-Postmark",
      "Resend",
      "resend",
      "EMAIL_PROVIDER",
      "EMAIL_FROM",
      "RESEND_API_KEY",
      "transactionalEmailTransportService",
      "passwordResetEmailService",
    ];


    for (
      const literal of
      forbiddenProviderAuthority
    ) {

      assert.equal(
        moduleSource.includes(
          literal
        ),
        false,
        literal
      );
    }
  }
);


test(
  "shared account email normalizer preserves the migration-era account behavior",
  () => {

    const cases = [
      [
        undefined,
        "",
      ],
      [
        null,
        "",
      ],
      [
        "",
        "",
      ],
      [
        " ",
        "",
      ],
      [
        "Student@Example.com",
        "student@example.com",
      ],
      [
        " Student@Example.com ",
        "student@example.com",
      ],
      [
        "student@example.com",
        "student@example.com",
      ],
      [
        "student+tag@example.com",
        "student+tag@example.com",
      ],
      [
        "student.name@example.co.in",
        "student.name@example.co.in",
      ],
      [
        "a@b.co",
        "a@b.co",
      ],
      [
        "student@example",
        "",
      ],
      [
        "student@localhost",
        "",
      ],
      [
        "@example.com",
        "",
      ],
      [
        "student@",
        "",
      ],
      [
        "student",
        "",
      ],
      [
        "student@@example.com",
        "",
      ],
      [
        "student @example.com",
        "",
      ],
      [
        "student@ example.com",
        "",
      ],
      [
        "student@example .com",
        "",
      ],
      [
        "student\t@example.com",
        "",
      ],
      [
        "student\n@example.com",
        "",
      ],
      [
        "student\r\n@example.com",
        "",
      ],
      [
        "STUDENT@EXAMPLE.COM",
        "student@example.com",
      ],
      [
        "a..b@example.com",
        "a..b@example.com",
      ],
      [
        ".student@example.com",
        ".student@example.com",
      ],
      [
        "student.@example.com",
        "student.@example.com",
      ],

      /*
       * These are intentionally preserved during the
       * provider migration.
       *
       * Any future tightening is a separate account-policy
       * decision and must deliberately update this contract.
       */
      [
        "student@example..com",
        "student@example..com",
      ],
      [
        "student@example.com.",
        "student@example.com.",
      ],

      [
        "student@-example.com",
        "student@-example.com",
      ],
      [
        "student@example-.com",
        "student@example-.com",
      ],
      [
        "student@example_foo.com",
        "student@example_foo.com",
      ],
      [
        "student@example.com,other@example.com",
        "",
      ],
      [
        "student@example.com;other@example.com",
        "",
      ],
      [
        "<student@example.com>",
        "<student@example.com>",
      ],
      [
        "Student <student@example.com>",
        "",
      ],
      [
        "\"student\"@example.com",
        "\"student\"@example.com",
      ],
      [
        "\u00fcser@example.com",
        "\u00fcser@example.com",
      ],
      [
        "student@ex\u00e4mple.com",
        "student@ex\u00e4mple.com",
      ],
      [
        123,
        "",
      ],
      [
        {},
        "",
      ],
      [
        [],
        "",
      ],
    ];


    assert.equal(
      cases.length,
      41
    );


    for (
      const [
        input,
        expected,
      ] of cases
    ) {

      assert.equal(
        normalizeSingleEmailAddress(
          input
        ),
        expected,
        JSON.stringify(input)
      );
    }


    /*
     * Preserve the exact 254-character account boundary.
     * "@example.com" is 12 characters.
     */
    const exactly254 =
      "a".repeat(242) +
      "@example.com";

    const over254 =
      "a".repeat(243) +
      "@example.com";


    assert.equal(
      exactly254.length,
      254
    );

    assert.equal(
      over254.length,
      255
    );

    assert.equal(
      normalizeSingleEmailAddress(
        exactly254
      ),
      exactly254
    );

    assert.equal(
      normalizeSingleEmailAddress(
        over254
      ),
      ""
    );
  }
);


test(
  "shared account email normalizer rejects every C0 and DEL control character",
  () => {

    const controlCodes =
      [];

    for (
      let code = 0;
      code <= 0x1f;
      code += 1
    ) {
      controlCodes.push(
        code
      );
    }

    controlCodes.push(
      0x7f
    );


    assert.equal(
      controlCodes.length,
      33
    );


    for (
      const code of
      controlCodes
    ) {

      const control =
        String.fromCharCode(
          code
        );

      const candidate =
        "student" +
        control +
        "@example.com";


      assert.equal(
        normalizeSingleEmailAddress(
          candidate
        ),
        "",
        "U+" +
          code
            .toString(16)
            .toUpperCase()
            .padStart(4, "0")
      );
    }
  }
);
