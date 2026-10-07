const test = require("node:test");
const assert = require("node:assert/strict");

const mongoose =
  require("mongoose");

const Purchase =
  require("../src/models/Purchase");

const Entitlement =
  require("../src/models/Entitlement");

const {
  fulfillPaymentPackagePurchase,
} = require(
  "../src/services/paymentFulfillmentService"
);

const ORIGINALS = {
  startSession:
    mongoose.startSession,

  purchaseFindOne:
    Purchase.findOne,

  entitlementFindOneAndUpdate:
    Entitlement.findOneAndUpdate,

  entitlementFindOne:
    Entitlement.findOne,
};

const TENANT_ID =
  "pravixoedutech";

const STUDENT_ID =
  "507f1f77bcf86cd799439011";

const PRODUCT_ID =
  "507f1f77bcf86cd799439012";

const PURCHASE_ID =
  "507f1f77bcf86cd799439013";

const MOCK_TEST_ID_1 =
  "507f1f77bcf86cd799439014";

const MOCK_TEST_ID_2 =
  "507f1f77bcf86cd799439015";

const ENTITLEMENT_ID =
  "507f1f77bcf86cd799439016";

const PAYMENT_ID =
  "pay_fulfillment_contract";

const OTHER_PAYMENT_ID =
  "pay_conflicting_contract";

const SIGNATURE =
  "signature_fulfillment_contract";

const FIXED_PAID_AT =
  new Date(
    "2026-09-28T12:00:00.000Z"
  );

let startSessionCalls;
let withTransactionCalls;
let endSessionCalls;

let sessionInstances;
let purchaseFindCalls;
let purchaseSessionCalls;
let purchaseSaveCalls;

let entitlementUpsertCalls;
let entitlementFindCalls;

let currentDatabasePurchase;
let recoveryPurchase;
let recoveryEntitlement;

let entitlementUpsertImpl;

const makePurchase = (
  overrides = {}
) => {
  const purchase = {
    _id:
      PURCHASE_ID,

    tenantId:
      TENANT_ID,

    studentId:
      STUDENT_ID,

    productId:
      PRODUCT_ID,

    productSnapshot: {
      title:
        "Fulfillment Contract Pack",

      slug:
        "fulfillment-contract-pack",

      productType:
        "mock_test_pack",

      includedMockTestIds: [
        MOCK_TEST_ID_1,
        MOCK_TEST_ID_2,
      ],

      validityDays:
        30,
    },

    amountInPaise:
      19900,

    currency:
      "INR",

    status:
      "created",

    provider:
      "razorpay",

    receipt:
      "pp_fulfillment_contract",

    razorpayOrderId:
      "order_fulfillment_contract",

    razorpayPaymentId:
      null,

    razorpaySignature:
      null,

    paidAt:
      null,

    failureReason:
      "previous-state",

    async save(options) {
      purchaseSaveCalls.push({
        purchase: this,
        options,
      });

      return this;
    },
  };

  Object.assign(
    purchase,
    overrides
  );

  return purchase;
};

const makeEntitlement = (
  overrides = {}
) => ({
  _id:
    ENTITLEMENT_ID,

  tenantId:
    TENANT_ID,

  studentId:
    STUDENT_ID,

  productId:
    PRODUCT_ID,

  purchaseId:
    PURCHASE_ID,

  entitlementType:
    "mock_test_pack",

  mockTestIds: [
    MOCK_TEST_ID_1,
    MOCK_TEST_ID_2,
  ],

  validFrom:
    FIXED_PAID_AT,

  validUntil:
    new Date(
      "2026-10-28T12:00:00.000Z"
    ),

  status:
    "active",

  ...overrides,
});

const makeSession = () => {
  const session = {
    async withTransaction(callback) {
      withTransactionCalls += 1;

      return callback();
    },

    async endSession() {
      endSessionCalls += 1;
    },
  };

  sessionInstances.push(
    session
  );

  return session;
};

const makePurchaseSessionQuery =
  (value) => ({
    async session(session) {
      purchaseSessionCalls.push(
        session
      );

      return value;
    },
  });

const addExpectedDays = (
  date,
  days
) => {
  const result =
    new Date(date);

  result.setDate(
    result.getDate() +
      Number(days)
  );

  return result;
};

const resetRuntime = () => {
  startSessionCalls = 0;
  withTransactionCalls = 0;
  endSessionCalls = 0;

  sessionInstances = [];
  purchaseFindCalls = [];
  purchaseSessionCalls = [];
  purchaseSaveCalls = [];

  entitlementUpsertCalls = [];
  entitlementFindCalls = [];

  currentDatabasePurchase =
    makePurchase();

  recoveryPurchase =
    null;

  recoveryEntitlement =
    null;

  mongoose.startSession =
    async () => {
      startSessionCalls += 1;

      return makeSession();
    };

  Purchase.findOne =
    (filter) => {
      purchaseFindCalls.push(
        filter
      );

      if (
        Object.prototype
          .hasOwnProperty.call(
            filter,
            "status"
          )
      ) {
        return Promise.resolve(
          recoveryPurchase
        );
      }

      return makePurchaseSessionQuery(
        currentDatabasePurchase
      );
    };

  entitlementUpsertImpl =
    async () =>
      makeEntitlement();

  Entitlement.findOneAndUpdate =
    async (
      filter,
      update,
      options
    ) => {
      entitlementUpsertCalls.push({
        filter,
        update,
        options,
      });

      return entitlementUpsertImpl(
        filter,
        update,
        options
      );
    };

  Entitlement.findOne =
    async (filter) => {
      entitlementFindCalls.push(
        filter
      );

      return recoveryEntitlement;
    };
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
  "fulfillment rejects missing purchase before opening a database session",
  async () => {
    await assert.rejects(
      () =>
        fulfillPaymentPackagePurchase({
          purchase:
            null,

          razorpayPaymentId:
            PAYMENT_ID,
        }),
      {
        message:
          "A valid purchase is required for payment fulfilment",
      }
    );

    assert.equal(
      startSessionCalls,
      0
    );

    assert.equal(
      entitlementUpsertCalls.length,
      0
    );
  }
);

serialTest(
  "fulfillment rejects a purchase with no mock tests before opening a database session",
  async () => {
    const purchase =
      makePurchase({
        productSnapshot: {
          includedMockTestIds:
            [],
          validityDays:
            30,
        },
      });

    await assert.rejects(
      () =>
        fulfillPaymentPackagePurchase({
          purchase,

          razorpayPaymentId:
            PAYMENT_ID,
        }),
      {
        message:
          "Paid purchase has no mock tests available for entitlement",
      }
    );

    assert.equal(
      startSessionCalls,
      0
    );

    assert.equal(
      purchaseSaveCalls.length,
      0
    );
  }
);

serialTest(
  "fulfillment rejects invalid paidAt before opening a database session",
  async () => {
    const purchase =
      makePurchase();

    await assert.rejects(
      () =>
        fulfillPaymentPackagePurchase({
          purchase,

          razorpayPaymentId:
            PAYMENT_ID,

          paidAt:
            "not-a-date",
        }),
      {
        message:
          "Invalid paidAt value for payment fulfilment",
      }
    );

    assert.equal(
      startSessionCalls,
      0
    );
  }
);

serialTest(
  "new purchase requires Razorpay payment ID before opening a transaction",
  async () => {
    const purchase =
      makePurchase();

    await assert.rejects(
      () =>
        fulfillPaymentPackagePurchase({
          purchase,

          razorpayPaymentId:
            "   ",

          paidAt:
            FIXED_PAID_AT,
        }),
      {
        message:
          "Razorpay payment ID is required for payment fulfilment",
      }
    );

    assert.equal(
      startSessionCalls,
      0
    );

    assert.equal(
      entitlementUpsertCalls.length,
      0
    );
  }
);

serialTest(
  "already-paid purchase repairs or reuses entitlement without opening a new transaction",
  async () => {
    const originalPaidAt =
      new Date(
        "2026-09-20T08:00:00.000Z"
      );

    const purchase =
      makePurchase({
        status:
          "paid",

        razorpayPaymentId:
          PAYMENT_ID,

        paidAt:
          originalPaidAt,
      });

    const result =
      await fulfillPaymentPackagePurchase({
        purchase,

        paidAt:
          FIXED_PAID_AT,
      });

    assert.equal(
      result.purchase,
      purchase
    );

    assert.equal(
      result.alreadyPaid,
      true
    );

    assert.equal(
      startSessionCalls,
      0
    );

    assert.equal(
      entitlementUpsertCalls.length,
      1
    );

    assert.deepEqual(
      entitlementUpsertCalls[0]
        .filter,
      {
        tenantId:
          TENANT_ID,

        studentId:
          STUDENT_ID,

        purchaseId:
          PURCHASE_ID,
      }
    );

    assert.equal(
      Object.prototype
        .hasOwnProperty.call(
          entitlementUpsertCalls[0]
            .options,
          "session"
        ),
      false
    );

    assert.equal(
      entitlementUpsertCalls[0]
        .update
        .$setOnInsert
        .validFrom
        .getTime(),
      originalPaidAt.getTime()
    );
  }
);

serialTest(
  "first fulfillment performs one transaction and atomically marks purchase paid with one entitlement upsert",
  async () => {
    const requestPurchase =
      makePurchase();

    currentDatabasePurchase =
      makePurchase();

    const result =
      await fulfillPaymentPackagePurchase({
        purchase:
          requestPurchase,

        razorpayPaymentId:
          "  " +
          PAYMENT_ID +
          "  ",

        razorpaySignature:
          "  " +
          SIGNATURE +
          "  ",

        paidAt:
          FIXED_PAID_AT,
      });

    assert.equal(
      startSessionCalls,
      1
    );

    assert.equal(
      withTransactionCalls,
      1
    );

    assert.equal(
      endSessionCalls,
      1
    );

    assert.equal(
      sessionInstances.length,
      1
    );

    assert.equal(
      purchaseFindCalls.length,
      1
    );

    assert.deepEqual(
      purchaseFindCalls[0],
      {
        _id:
          PURCHASE_ID,

        tenantId:
          TENANT_ID,

        studentId:
          STUDENT_ID,

        provider:
          "razorpay",
      }
    );

    assert.equal(
      purchaseSessionCalls.length,
      1
    );

    assert.equal(
      purchaseSessionCalls[0],
      sessionInstances[0]
    );

    assert.equal(
      entitlementUpsertCalls.length,
      1
    );

    const upsert =
      entitlementUpsertCalls[0];

    assert.deepEqual(
      upsert.filter,
      {
        tenantId:
          TENANT_ID,

        studentId:
          STUDENT_ID,

        purchaseId:
          PURCHASE_ID,
      }
    );

    assert.equal(
      upsert.options.new,
      true
    );

    assert.equal(
      upsert.options.upsert,
      true
    );

    assert.equal(
      upsert.options
        .setDefaultsOnInsert,
      true
    );

    assert.equal(
      upsert.options.session,
      sessionInstances[0]
    );

    assert.equal(
      upsert.update
        .$setOnInsert
        .productId,
      PRODUCT_ID
    );

    assert.equal(
      upsert.update
        .$setOnInsert
        .entitlementType,
      "mock_test_pack"
    );

    assert.deepEqual(
      upsert.update
        .$setOnInsert
        .mockTestIds,
      [
        MOCK_TEST_ID_1,
        MOCK_TEST_ID_2,
      ]
    );

    assert.equal(
      upsert.update
        .$setOnInsert
        .status,
      "active"
    );

    assert.equal(
      upsert.update
        .$setOnInsert
        .validFrom
        .getTime(),
      FIXED_PAID_AT.getTime()
    );

    const expectedValidUntil =
      addExpectedDays(
        FIXED_PAID_AT,
        30
      );

    assert.equal(
      upsert.update
        .$setOnInsert
        .validUntil
        .getTime(),
      expectedValidUntil
        .getTime()
    );

    assert.equal(
      currentDatabasePurchase
        .status,
      "paid"
    );

    assert.equal(
      currentDatabasePurchase
        .razorpayPaymentId,
      PAYMENT_ID
    );

    assert.equal(
      currentDatabasePurchase
        .razorpaySignature,
      SIGNATURE
    );

    assert.equal(
      currentDatabasePurchase
        .paidAt
        .getTime(),
      FIXED_PAID_AT.getTime()
    );

    assert.equal(
      currentDatabasePurchase
        .failureReason,
      undefined
    );

    assert.equal(
      purchaseSaveCalls.length,
      1
    );

    assert.equal(
      purchaseSaveCalls[0]
        .options
        .session,
      sessionInstances[0]
    );

    assert.equal(
      result.purchase,
      currentDatabasePurchase
    );

    assert.equal(
      result.alreadyPaid,
      false
    );

    assert.equal(
      result.entitlement.status,
      "active"
    );
  }
);

serialTest(
  "same-payment concurrent replay returns alreadyPaid without saving purchase again",
  async () => {
    const requestPurchase =
      makePurchase();

    currentDatabasePurchase =
      makePurchase({
        status:
          "paid",

        razorpayPaymentId:
          PAYMENT_ID,

        paidAt:
          FIXED_PAID_AT,
      });

    const result =
      await fulfillPaymentPackagePurchase({
        purchase:
          requestPurchase,

        razorpayPaymentId:
          PAYMENT_ID,

        paidAt:
          FIXED_PAID_AT,
      });

    assert.equal(
      result.alreadyPaid,
      true
    );

    assert.equal(
      result.purchase,
      currentDatabasePurchase
    );

    assert.equal(
      entitlementUpsertCalls.length,
      1
    );

    assert.equal(
      entitlementUpsertCalls[0]
        .options
        .session,
      sessionInstances[0]
    );

    assert.equal(
      purchaseSaveCalls.length,
      0
    );

    assert.equal(
      endSessionCalls,
      1
    );
  }
);

serialTest(
  "different-payment concurrent replay is rejected and never touches entitlement",
  async () => {
    const requestPurchase =
      makePurchase();

    currentDatabasePurchase =
      makePurchase({
        status:
          "paid",

        razorpayPaymentId:
          OTHER_PAYMENT_ID,

        paidAt:
          FIXED_PAID_AT,
      });

    await assert.rejects(
      () =>
        fulfillPaymentPackagePurchase({
          purchase:
            requestPurchase,

          razorpayPaymentId:
            PAYMENT_ID,

          paidAt:
            FIXED_PAID_AT,
        }),
      {
        message:
          "Purchase is already linked to a different Razorpay payment",
      }
    );

    assert.equal(
      entitlementUpsertCalls.length,
      0
    );

    assert.equal(
      purchaseSaveCalls.length,
      0
    );

    assert.equal(
      endSessionCalls,
      1
    );
  }
);

serialTest(
  "stale created caller cannot fulfill purchase whose database state is no longer created",
  async () => {
    const requestPurchase =
      makePurchase();

    currentDatabasePurchase =
      makePurchase({
        status:
          "failed",
      });

    await assert.rejects(
      () =>
        fulfillPaymentPackagePurchase({
          purchase:
            requestPurchase,

          razorpayPaymentId:
            PAYMENT_ID,

          paidAt:
            FIXED_PAID_AT,
        }),
      {
        message:
          "Purchase status failed is not eligible for fulfilment",
      }
    );

    assert.equal(
      entitlementUpsertCalls.length,
      0
    );

    assert.equal(
      purchaseSaveCalls.length,
      0
    );

    assert.equal(
      endSessionCalls,
      1
    );
  }
);

serialTest(
  "duplicate-key race recovers only from exact paid purchase and existing entitlement",
  async () => {
    const requestPurchase =
      makePurchase();

    currentDatabasePurchase =
      makePurchase();

    const duplicateError =
      new Error(
        "controlled duplicate key race"
      );

    duplicateError.code =
      11000;

    entitlementUpsertImpl =
      async () => {
        throw duplicateError;
      };

    recoveryPurchase =
      makePurchase({
        status:
          "paid",

        razorpayPaymentId:
          PAYMENT_ID,

        paidAt:
          FIXED_PAID_AT,
      });

    recoveryEntitlement =
      makeEntitlement();

    const result =
      await fulfillPaymentPackagePurchase({
        purchase:
          requestPurchase,

        razorpayPaymentId:
          PAYMENT_ID,

        paidAt:
          FIXED_PAID_AT,
      });

    assert.equal(
      result.alreadyPaid,
      true
    );

    assert.equal(
      result.purchase,
      recoveryPurchase
    );

    assert.equal(
      result.entitlement,
      recoveryEntitlement
    );

    assert.equal(
      purchaseFindCalls.length,
      2
    );

    assert.deepEqual(
      purchaseFindCalls[1],
      {
        _id:
          PURCHASE_ID,

        tenantId:
          TENANT_ID,

        studentId:
          STUDENT_ID,

        provider:
          "razorpay",

        status:
          "paid",

        razorpayPaymentId:
          PAYMENT_ID,
      }
    );

    assert.equal(
      entitlementFindCalls.length,
      1
    );

    assert.deepEqual(
      entitlementFindCalls[0],
      {
        tenantId:
          TENANT_ID,

        studentId:
          STUDENT_ID,

        purchaseId:
          PURCHASE_ID,
      }
    );

    assert.equal(
      endSessionCalls,
      1
    );
  }
);

serialTest(
  "incomplete duplicate-key recovery rethrows original race error and still closes session",
  async () => {
    const requestPurchase =
      makePurchase();

    currentDatabasePurchase =
      makePurchase();

    const duplicateError =
      new Error(
        "controlled incomplete duplicate key race"
      );

    duplicateError.code =
      11000;

    entitlementUpsertImpl =
      async () => {
        throw duplicateError;
      };

    recoveryPurchase =
      null;

    recoveryEntitlement =
      null;

    await assert.rejects(
      () =>
        fulfillPaymentPackagePurchase({
          purchase:
            requestPurchase,

          razorpayPaymentId:
            PAYMENT_ID,

          paidAt:
            FIXED_PAID_AT,
        }),
      (error) => {
        assert.equal(
          error,
          duplicateError
        );

        assert.equal(
          error.code,
          11000
        );

        return true;
      }
    );

    assert.equal(
      entitlementFindCalls.length,
      0
    );

    assert.equal(
      endSessionCalls,
      1
    );
  }
);

test.after(() => {
  mongoose.startSession =
    ORIGINALS.startSession;

  Purchase.findOne =
    ORIGINALS.purchaseFindOne;

  Entitlement.findOneAndUpdate =
    ORIGINALS
      .entitlementFindOneAndUpdate;

  Entitlement.findOne =
    ORIGINALS.entitlementFindOne;
});
