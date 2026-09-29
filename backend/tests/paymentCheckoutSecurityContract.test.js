const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

const PaymentProduct =
  require("../src/models/PaymentProduct");

const Purchase =
  require("../src/models/Purchase");

const Entitlement =
  require("../src/models/Entitlement");

const controllerPath =
  require.resolve(
    "../src/controllers/studentMockTestController"
  );

const fulfillmentServicePath =
  require.resolve(
    "../src/services/paymentFulfillmentService"
  );

const referralRewardServicePath =
  require.resolve(
    "../src/services/referralRewardService"
  );

const razorpayPath =
  require.resolve("razorpay");

const originalControllerCache =
  require.cache[controllerPath];

const originalFulfillmentCache =
  require.cache[fulfillmentServicePath];

const originalReferralRewardCache =
  require.cache[referralRewardServicePath];

const originalRazorpayCache =
  require.cache[razorpayPath];

const ORIGINALS = {
  paymentProductFindOne:
    PaymentProduct.findOne,

  purchaseFindOne:
    Purchase.findOne,

  purchaseCreate:
    Purchase.create,

  entitlementFindOne:
    Entitlement.findOne,

  keyId:
    process.env.RAZORPAY_KEY_ID,

  keySecret:
    process.env.RAZORPAY_KEY_SECRET,
};

const TEST_KEY_ID =
  "rzp_test_payment_contract";

const TEST_KEY_SECRET =
  "payment-contract-secret";

const TENANT_ID =
  "pravixoedutech";

const STUDENT_ID =
  "507f1f77bcf86cd799439011";

const PRODUCT_ID =
  "507f1f77bcf86cd799439012";

const PURCHASE_ID =
  "507f1f77bcf86cd799439013";

const MOCK_TEST_ID =
  "507f1f77bcf86cd799439014";

const ENTITLEMENT_ID =
  "507f1f77bcf86cd799439015";

const ORDER_ID =
  "order_payment_contract";

const PAYMENT_ID =
  "pay_payment_contract";

let razorpayConstructorCalls = [];
let orderCreateCalls = [];
let paymentFetchCalls = [];
let purchaseFindCalls = [];
let purchaseCreateCalls = [];
let fulfillmentCalls = [];
let referralCalls = [];

let currentProduct;
let currentEntitlement;
let currentPurchase;

let orderCreateImpl;
let paymentFetchImpl;
let fulfillmentImpl;
let referralImpl;

const cacheModule = (
  filename,
  exports
) => {
  require.cache[filename] = {
    id: filename,
    filename,
    loaded: true,
    exports,
    children: [],
    paths: [],
  };
};

class FakeRazorpay {
  constructor(options) {
    razorpayConstructorCalls.push(
      options
    );

    this.orders = {
      create: async (payload) => {
        orderCreateCalls.push(
          payload
        );

        return orderCreateImpl(
          payload
        );
      },
    };

    this.payments = {
      fetch: async (paymentId) => {
        paymentFetchCalls.push(
          paymentId
        );

        return paymentFetchImpl(
          paymentId
        );
      },
    };
  }
}

cacheModule(
  razorpayPath,
  FakeRazorpay
);

cacheModule(
  fulfillmentServicePath,
  {
    fulfillPaymentPackagePurchase:
      async (input) => {
        fulfillmentCalls.push(
          input
        );

        return fulfillmentImpl(
          input
        );
      },
  }
);

cacheModule(
  referralRewardServicePath,
  {
    createPendingReferralRewardForPaidPurchase:
      async (input) => {
        referralCalls.push(
          input
        );

        return referralImpl(
          input
        );
      },
  }
);

delete require.cache[
  controllerPath
];

const {
  createPaymentPackageOrderForStudent,
  verifyPaymentPackagePaymentForStudent,
} = require(
  "../src/controllers/studentMockTestController"
);

const makeLeanQuery = (
  value
) => ({
  lean: async () => value,
});

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

const signCheckout = ({
  orderId = ORDER_ID,
  paymentId = PAYMENT_ID,
} = {}) => {
  return crypto
    .createHmac(
      "sha256",
      TEST_KEY_SECRET
    )
    .update(
      orderId +
        "|" +
        paymentId
    )
    .digest("hex");
};

const makeProduct = (
  overrides = {}
) => ({
  _id: PRODUCT_ID,
  title:
    "Payment Contract Pack",
  slug:
    "payment-contract-pack",
  productType:
    "mock_test_pack",
  priceInPaise:
    19900,
  currency:
    "INR",
  validityDays:
    30,
  includedMockTestIds: [
    MOCK_TEST_ID,
  ],
  isActive:
    true,
  ...overrides,
});

const makePurchase = (
  overrides = {}
) => ({
  _id: PURCHASE_ID,
  tenantId:
    TENANT_ID,
  studentId:
    STUDENT_ID,
  productId:
    PRODUCT_ID,
  productSnapshot: {
    title:
      "Payment Contract Pack",
    slug:
      "payment-contract-pack",
    productType:
      "mock_test_pack",
    includedMockTestIds: [
      MOCK_TEST_ID,
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
    "pp_contract",
  razorpayOrderId:
    ORDER_ID,
  razorpayPaymentId:
    null,
  razorpaySignature:
    null,
  paidAt:
    null,
  ...overrides,
});

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
  status:
    "active",
  validFrom:
    new Date(
      "2026-09-28T00:00:00.000Z"
    ),
  validUntil:
    new Date(
      "2026-10-28T00:00:00.000Z"
    ),
  mockTestIds: [
    MOCK_TEST_ID,
  ],
  ...overrides,
});

const makeStudentRequest = ({
  params = {},
  body = {},
} = {}) => ({
  user: {
    _id:
      STUDENT_ID,
    tenantId:
      TENANT_ID,
  },
  params,
  body,
});

const resetRuntime = () => {
  razorpayConstructorCalls = [];
  orderCreateCalls = [];
  paymentFetchCalls = [];
  purchaseFindCalls = [];
  purchaseCreateCalls = [];
  fulfillmentCalls = [];
  referralCalls = [];

  currentProduct =
    makeProduct();

  currentEntitlement =
    null;

  currentPurchase =
    makePurchase();

  orderCreateImpl =
    async (payload) => ({
      id:
        ORDER_ID,
      amount:
        payload.amount,
      currency:
        payload.currency,
      receipt:
        payload.receipt,
    });

  paymentFetchImpl =
    async () => ({
      id:
        PAYMENT_ID,
      order_id:
        ORDER_ID,
      amount:
        currentPurchase
          .amountInPaise,
      currency:
        currentPurchase
          .currency,
      status:
        "captured",
    });

  fulfillmentImpl =
    async (input) => {
      const paidPurchase = {
        ...input.purchase,
        status:
          "paid",
        razorpayPaymentId:
          input.razorpayPaymentId ||
          input.purchase
            .razorpayPaymentId,
        razorpaySignature:
          input.razorpaySignature ||
          input.purchase
            .razorpaySignature,
        paidAt:
          input.paidAt ||
          input.purchase
            .paidAt ||
          new Date(),
      };

      return {
        purchase:
          paidPurchase,

        entitlement:
          makeEntitlement(),

        alreadyPaid:
          false,
      };
    };

  referralImpl =
    async () => null;

  PaymentProduct.findOne =
    () =>
      makeLeanQuery(
        currentProduct
      );

  Entitlement.findOne =
    () =>
      makeLeanQuery(
        currentEntitlement
      );

  Purchase.findOne =
    async (filter) => {
      purchaseFindCalls.push(
        filter
      );

      return currentPurchase;
    };

  Purchase.create =
    async (payload) => {
      purchaseCreateCalls.push(
        payload
      );

      return {
        ...payload,
        _id:
          PURCHASE_ID,
      };
    };

  process.env.RAZORPAY_KEY_ID =
    TEST_KEY_ID;

  process.env.RAZORPAY_KEY_SECRET =
    TEST_KEY_SECRET;
};

const runCreateOrder = async ({
  body = {},
} = {}) => {
  const req =
    makeStudentRequest({
      params: {
        productId:
          PRODUCT_ID,
      },
      body,
    });

  const res =
    makeResponse();

  await createPaymentPackageOrderForStudent(
    req,
    res
  );

  return {
    req,
    res,
  };
};

const runVerify = async ({
  body,
} = {}) => {
  const req =
    makeStudentRequest({
      body:
        body || {
          razorpay_order_id:
            ORDER_ID,

          razorpay_payment_id:
            PAYMENT_ID,

          razorpay_signature:
            signCheckout(),
        },
    });

  const res =
    makeResponse();

  await verifyPaymentPackagePaymentForStudent(
    req,
    res
  );

  return {
    req,
    res,
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
  "create-order ignores client pricing authority and uses server product price",
  async () => {
    const {
      res,
    } =
      await runCreateOrder({
        body: {
          priceInPaise:
            1,
          amount:
            1,
          currency:
            "USD",
        },
      });

    assert.equal(
      res.statusCode,
      201
    );

    assert.equal(
      res.body.success,
      true
    );

    assert.equal(
      res.body.message,
      "Payment order created successfully"
    );

    assert.equal(
      orderCreateCalls.length,
      1
    );

    assert.equal(
      orderCreateCalls[0]
        .amount,
      19900
    );

    assert.equal(
      orderCreateCalls[0]
        .currency,
      "INR"
    );

    assert.equal(
      purchaseCreateCalls.length,
      1
    );

    assert.equal(
      purchaseCreateCalls[0]
        .amountInPaise,
      19900
    );

    assert.equal(
      purchaseCreateCalls[0]
        .currency,
      "INR"
    );

    assert.equal(
      purchaseCreateCalls[0]
        .provider,
      "razorpay"
    );

    assert.equal(
      purchaseCreateCalls[0]
        .razorpayOrderId,
      ORDER_ID
    );

    assert.deepEqual(
      razorpayConstructorCalls,
      [
        {
          key_id:
            TEST_KEY_ID,
          key_secret:
            TEST_KEY_SECRET,
        },
      ]
    );
  }
);

serialTest(
  "create-order blocks checkout when an active entitlement already exists",
  async () => {
    currentEntitlement =
      makeEntitlement();

    const {
      res,
    } =
      await runCreateOrder();

    assert.equal(
      res.statusCode,
      409
    );

    assert.equal(
      res.body.success,
      false
    );

    assert.equal(
      res.body.message,
      "You already have active access for this payment package"
    );

    assert.equal(
      res.body.data
        .hasActiveEntitlement,
      true
    );

    assert.equal(
      orderCreateCalls.length,
      0
    );

    assert.equal(
      purchaseCreateCalls.length,
      0
    );
  }
);

serialTest(
  "verify-payment rejects missing Razorpay verification fields before purchase lookup",
  async () => {
    const {
      res,
    } =
      await runVerify({
        body: {
          razorpay_order_id:
            ORDER_ID,
        },
      });

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

    assert.equal(
      purchaseFindCalls.length,
      0
    );

    assert.equal(
      paymentFetchCalls.length,
      0
    );

    assert.equal(
      fulfillmentCalls.length,
      0
    );
  }
);

serialTest(
  "verify-payment rejects invalid checkout signature before Razorpay payment fetch",
  async () => {
    const {
      res,
    } =
      await runVerify({
        body: {
          razorpay_order_id:
            ORDER_ID,

          razorpay_payment_id:
            PAYMENT_ID,

          razorpay_signature:
            "invalid-signature",
        },
      });

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
      "Invalid Razorpay payment signature"
    );

    assert.equal(
      purchaseFindCalls.length,
      1
    );

    assert.equal(
      paymentFetchCalls.length,
      0
    );

    assert.equal(
      fulfillmentCalls.length,
      0
    );
  }
);

serialTest(
  "verify-payment rejects payment belonging to a different Razorpay order",
  async () => {
    paymentFetchImpl =
      async () => ({
        id:
          PAYMENT_ID,
        order_id:
          "order_different",
        amount:
          19900,
        currency:
          "INR",
        status:
          "captured",
      });

    const {
      res,
    } =
      await runVerify();

    assert.equal(
      res.statusCode,
      400
    );

    assert.equal(
      res.body.message,
      "Razorpay payment does not belong to this order"
    );

    assert.equal(
      paymentFetchCalls.length,
      1
    );

    assert.equal(
      fulfillmentCalls.length,
      0
    );
  }
);

serialTest(
  "verify-payment rejects Razorpay amount mismatch",
  async () => {
    paymentFetchImpl =
      async () => ({
        id:
          PAYMENT_ID,
        order_id:
          ORDER_ID,
        amount:
          1,
        currency:
          "INR",
        status:
          "captured",
      });

    const {
      res,
    } =
      await runVerify();

    assert.equal(
      res.statusCode,
      400
    );

    assert.equal(
      res.body.message,
      "Razorpay payment amount mismatch"
    );

    assert.equal(
      fulfillmentCalls.length,
      0
    );
  }
);

serialTest(
  "verify-payment rejects Razorpay currency mismatch",
  async () => {
    paymentFetchImpl =
      async () => ({
        id:
          PAYMENT_ID,
        order_id:
          ORDER_ID,
        amount:
          19900,
        currency:
          "USD",
        status:
          "captured",
      });

    const {
      res,
    } =
      await runVerify();

    assert.equal(
      res.statusCode,
      400
    );

    assert.equal(
      res.body.message,
      "Razorpay payment currency mismatch"
    );

    assert.equal(
      fulfillmentCalls.length,
      0
    );
  }
);

serialTest(
  "verify-payment does not unlock access before Razorpay payment is captured",
  async () => {
    paymentFetchImpl =
      async () => ({
        id:
          PAYMENT_ID,
        order_id:
          ORDER_ID,
        amount:
          19900,
        currency:
          "INR",
        status:
          "authorized",
      });

    const {
      res,
    } =
      await runVerify();

    assert.equal(
      res.statusCode,
      409
    );

    assert.equal(
      res.body.success,
      false
    );

    assert.equal(
      res.body.message,
      "Payment is not captured yet"
    );

    assert.equal(
      res.body.data
        .paymentStatus,
      "authorized"
    );

    assert.equal(
      fulfillmentCalls.length,
      0
    );
  }
);

serialTest(
  "captured payment reaches shared fulfillment exactly once with verified provider identifiers",
  async () => {
    const {
      res,
    } =
      await runVerify();

    assert.equal(
      res.statusCode,
      200
    );

    assert.equal(
      res.body.success,
      true
    );

    assert.equal(
      res.body.message,
      "Payment verified and mock test access unlocked"
    );

    assert.equal(
      paymentFetchCalls.length,
      1
    );

    assert.equal(
      fulfillmentCalls.length,
      1
    );

    assert.equal(
      fulfillmentCalls[0]
        .purchase
        ._id,
      PURCHASE_ID
    );

    assert.equal(
      fulfillmentCalls[0]
        .razorpayPaymentId,
      PAYMENT_ID
    );

    assert.equal(
      fulfillmentCalls[0]
        .razorpaySignature,
      signCheckout()
    );

    assert.ok(
      fulfillmentCalls[0]
        .paidAt instanceof Date
    );

    assert.equal(
      referralCalls.length,
      1
    );

    assert.equal(
      res.body.data
        .purchase
        .status,
      "paid"
    );

    assert.equal(
      res.body.data
        .purchase
        .razorpayPaymentId,
      PAYMENT_ID
    );

    assert.equal(
      res.body.data
        .entitlement
        .status,
      "active"
    );
  }
);

test.after(() => {
  PaymentProduct.findOne =
    ORIGINALS
      .paymentProductFindOne;

  Purchase.findOne =
    ORIGINALS
      .purchaseFindOne;

  Purchase.create =
    ORIGINALS
      .purchaseCreate;

  Entitlement.findOne =
    ORIGINALS
      .entitlementFindOne;

  if (
    ORIGINALS.keyId ===
    undefined
  ) {
    delete process.env
      .RAZORPAY_KEY_ID;
  } else {
    process.env
      .RAZORPAY_KEY_ID =
      ORIGINALS.keyId;
  }

  if (
    ORIGINALS.keySecret ===
    undefined
  ) {
    delete process.env
      .RAZORPAY_KEY_SECRET;
  } else {
    process.env
      .RAZORPAY_KEY_SECRET =
      ORIGINALS.keySecret;
  }

  if (
    originalRazorpayCache
  ) {
    require.cache[
      razorpayPath
    ] =
      originalRazorpayCache;
  } else {
    delete require.cache[
      razorpayPath
    ];
  }

  if (
    originalFulfillmentCache
  ) {
    require.cache[
      fulfillmentServicePath
    ] =
      originalFulfillmentCache;
  } else {
    delete require.cache[
      fulfillmentServicePath
    ];
  }

  if (
    originalReferralRewardCache
  ) {
    require.cache[
      referralRewardServicePath
    ] =
      originalReferralRewardCache;
  } else {
    delete require.cache[
      referralRewardServicePath
    ];
  }

  if (
    originalControllerCache
  ) {
    require.cache[
      controllerPath
    ] =
      originalControllerCache;
  } else {
    delete require.cache[
      controllerPath
    ];
  }
});
