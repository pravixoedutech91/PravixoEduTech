const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

const Purchase =
  require("../src/models/Purchase");

const RazorpayWebhookEvent =
  require("../src/models/RazorpayWebhookEvent");

const {
  parseRazorpayWebhookPayload,
  verifyRazorpayWebhookSignature,
} = require(
  "../src/services/razorpayWebhookService"
);

const controllerPath =
  require.resolve(
    "../src/controllers/razorpayWebhookController"
  );

const fulfillmentServicePath =
  require.resolve(
    "../src/services/paymentFulfillmentService"
  );

const referralServicePath =
  require.resolve(
    "../src/services/referralRewardService"
  );

const originalControllerCache =
  require.cache[controllerPath];

const originalFulfillmentCache =
  require.cache[fulfillmentServicePath];

const originalReferralCache =
  require.cache[referralServicePath];

const ORIGINALS = {
  purchaseFind:
    Purchase.find,

  eventFindOne:
    RazorpayWebhookEvent.findOne,

  eventCreate:
    RazorpayWebhookEvent.create,

  webhookSecret:
    process.env.RAZORPAY_WEBHOOK_SECRET,
};

const WEBHOOK_SECRET =
  "webhook-contract-secret";

const EVENT_ID =
  "evt_webhook_contract";

const TENANT_ID =
  "pravixoedutech";

const STUDENT_ID =
  "507f1f77bcf86cd799439011";

const PRODUCT_ID =
  "507f1f77bcf86cd799439012";

const PURCHASE_ID =
  "507f1f77bcf86cd799439013";

const ORDER_ID =
  "order_webhook_contract";

const PAYMENT_ID =
  "pay_webhook_contract";

const OTHER_PAYMENT_ID =
  "pay_other_contract";

const CREATED_AT_SECONDS =
  1790596800;

let matchingPurchases;
let existingWebhookEvent;

let purchaseFindCalls;
let eventFindOneCalls;
let eventLeanCalls;
let eventDirectAwaitCalls;
let eventCreateCalls;

let fulfillmentCalls;
let referralCalls;

let eventCreateImpl;
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
  referralServicePath,
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
  handleRazorpayWebhook,
} = require(
  "../src/controllers/razorpayWebhookController"
);

const makePurchase = (
  overrides = {}
) => ({
  _id:
    PURCHASE_ID,

  tenantId:
    TENANT_ID,

  studentId:
    STUDENT_ID,

  productId:
    PRODUCT_ID,

  amountInPaise:
    19900,

  currency:
    "INR",

  status:
    "created",

  provider:
    "razorpay",

  razorpayOrderId:
    ORDER_ID,

  razorpayPaymentId:
    null,

  paidAt:
    null,

  ...overrides,
});

const makeCapturedPayload = (
  overrides = {}
) => {
  const paymentOverrides =
    overrides.payment || {};

  return {
    event:
      Object.prototype
        .hasOwnProperty.call(
          overrides,
          "event"
        )
        ? overrides.event
        : "payment.captured",

    created_at:
      Object.prototype
        .hasOwnProperty.call(
          overrides,
          "created_at"
        )
        ? overrides.created_at
        : CREATED_AT_SECONDS,

    payload: {
      payment: {
        entity: {
          entity:
            "payment",

          id:
            PAYMENT_ID,

          order_id:
            ORDER_ID,

          status:
            "captured",

          captured:
            true,

          amount:
            19900,

          currency:
            "INR",

          ...paymentOverrides,
        },
      },
    },
  };
};

const makeRawBody = (
  payload
) =>
  Buffer.from(
    JSON.stringify(payload),
    "utf8"
  );

const signRawBody = (
  rawBody,
  secret = WEBHOOK_SECRET
) =>
  crypto
    .createHmac(
      "sha256",
      secret
    )
    .update(rawBody)
    .digest("hex");

const makeRequest = ({
  rawBody,
  signature,
  eventId = EVENT_ID,
} = {}) => {
  const headers = {
    "x-razorpay-signature":
      signature,

    "x-razorpay-event-id":
      eventId,
  };

  return {
    body:
      rawBody,

    get(name) {
      return (
        headers[
          String(name)
            .toLowerCase()
        ] || ""
      );
    },
  };
};

const makeResponse = () => ({
  statusCode:
    200,

  body:
    undefined,

  status(code) {
    this.statusCode =
      code;

    return this;
  },

  json(payload) {
    this.body =
      payload;

    return this;
  },
});

const makeEventFindQuery = (
  filter
) => {
  const snapshot =
    existingWebhookEvent;

  return {
    async lean() {
      eventLeanCalls.push(
        filter
      );

      return snapshot;
    },

    then(resolve, reject) {
      eventDirectAwaitCalls.push(
        filter
      );

      return Promise
        .resolve(snapshot)
        .then(resolve, reject);
    },
  };
};

const resetRuntime = () => {
  matchingPurchases = [
    makePurchase(),
  ];

  existingWebhookEvent =
    null;

  purchaseFindCalls = [];
  eventFindOneCalls = [];
  eventLeanCalls = [];
  eventDirectAwaitCalls = [];
  eventCreateCalls = [];

  fulfillmentCalls = [];
  referralCalls = [];

  process.env
    .RAZORPAY_WEBHOOK_SECRET =
    WEBHOOK_SECRET;

  Purchase.find =
    (filter) => ({
      async limit(limit) {
        purchaseFindCalls.push({
          filter,
          limit,
        });

        return matchingPurchases;
      },
    });

  RazorpayWebhookEvent.findOne =
    (filter) => {
      eventFindOneCalls.push(
        filter
      );

      return makeEventFindQuery(
        filter
      );
    };

  eventCreateImpl =
    async (payload) => ({
      _id:
        "507f1f77bcf86cd799439099",
      ...payload,
    });

  RazorpayWebhookEvent.create =
    async (payload) => {
      eventCreateCalls.push(
        payload
      );

      return eventCreateImpl(
        payload
      );
    };

  fulfillmentImpl =
    async ({
      purchase,
      razorpayPaymentId,
      paidAt,
    }) => ({
      purchase: {
        ...purchase,

        status:
          "paid",

        razorpayPaymentId,

        paidAt,
      },

      entitlement: {
        status:
          "active",
      },

      alreadyPaid:
        false,
    });

  referralImpl =
    async () => null;
};

const runWebhook = async ({
  payload = makeCapturedPayload(),
  rawBody,
  signature,
  eventId = EVENT_ID,
} = {}) => {
  const effectiveRawBody =
    rawBody === undefined
      ? makeRawBody(payload)
      : rawBody;

  const effectiveSignature =
    signature === undefined &&
    Buffer.isBuffer(
      effectiveRawBody
    )
      ? signRawBody(
          effectiveRawBody
        )
      : signature;

  const req =
    makeRequest({
      rawBody:
        effectiveRawBody,

      signature:
        effectiveSignature,

      eventId,
    });

  const res =
    makeResponse();

  await handleRazorpayWebhook(
    req,
    res
  );

  return {
    req,
    res,
    rawBody:
      effectiveRawBody,
    signature:
      effectiveSignature,
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
  "webhook signature helper accepts exact raw-body HMAC and rejects a different signature",
  async () => {
    const rawBody =
      makeRawBody(
        makeCapturedPayload()
      );

    const signature =
      signRawBody(
        rawBody
      );

    assert.equal(
      verifyRazorpayWebhookSignature({
        rawBody,
        signature,
        secret:
          WEBHOOK_SECRET,
      }),
      true
    );

    assert.equal(
      verifyRazorpayWebhookSignature({
        rawBody,
        signature:
          "wrong-signature",
        secret:
          WEBHOOK_SECRET,
      }),
      false
    );

    assert.equal(
      verifyRazorpayWebhookSignature({
        rawBody:
          rawBody.toString(
            "utf8"
          ),
        signature,
        secret:
          WEBHOOK_SECRET,
      }),
      false
    );
  }
);

serialTest(
  "webhook payload parser requires raw Buffer and object JSON",
  async () => {
    const payload =
      makeCapturedPayload();

    const rawBody =
      makeRawBody(
        payload
      );

    assert.deepEqual(
      parseRazorpayWebhookPayload(
        rawBody
      ),
      payload
    );

    assert.throws(
      () =>
        parseRazorpayWebhookPayload(
          rawBody.toString(
            "utf8"
          )
        ),
      {
        message:
          "Razorpay webhook body must be a raw buffer",
      }
    );

    assert.throws(
      () =>
        parseRazorpayWebhookPayload(
          Buffer.from(
            "[]",
            "utf8"
          )
        ),
      {
        message:
          "Razorpay webhook payload must be an object",
      }
    );
  }
);

serialTest(
  "webhook fails closed when webhook secret is not configured",
  async () => {
    delete process.env
      .RAZORPAY_WEBHOOK_SECRET;

    const {
      res,
    } =
      await runWebhook();

    assert.equal(
      res.statusCode,
      503
    );

    assert.equal(
      res.body.message,
      "Payment webhook is not configured"
    );

    assert.equal(
      eventFindOneCalls.length,
      0
    );

    assert.equal(
      fulfillmentCalls.length,
      0
    );
  }
);

serialTest(
  "webhook rejects non-buffer request body before signature processing",
  async () => {
    const {
      res,
    } =
      await runWebhook({
        rawBody: {
          event:
            "payment.captured",
        },
        signature:
          "irrelevant",
      });

    assert.equal(
      res.statusCode,
      415
    );

    assert.equal(
      res.body.message,
      "Raw JSON webhook body is required"
    );

    assert.equal(
      eventFindOneCalls.length,
      0
    );
  }
);

serialTest(
  "webhook requires Razorpay signature",
  async () => {
    const rawBody =
      makeRawBody(
        makeCapturedPayload()
      );

    const {
      res,
    } =
      await runWebhook({
        rawBody,
        signature:
          "",
      });

    assert.equal(
      res.statusCode,
      401
    );

    assert.equal(
      res.body.message,
      "Webhook signature is required"
    );

    assert.equal(
      eventFindOneCalls.length,
      0
    );
  }
);

serialTest(
  "webhook rejects invalid Razorpay signature before payload processing",
  async () => {
    const {
      res,
    } =
      await runWebhook({
        signature:
          "invalid-signature",
      });

    assert.equal(
      res.statusCode,
      401
    );

    assert.equal(
      res.body.message,
      "Invalid webhook signature"
    );

    assert.equal(
      eventFindOneCalls.length,
      0
    );

    assert.equal(
      fulfillmentCalls.length,
      0
    );
  }
);

serialTest(
  "webhook rejects malformed JSON after valid signature",
  async () => {
    const rawBody =
      Buffer.from(
        "{not-json",
        "utf8"
      );

    const {
      res,
    } =
      await runWebhook({
        rawBody,
        signature:
          signRawBody(
            rawBody
          ),
      });

    assert.equal(
      res.statusCode,
      400
    );

    assert.equal(
      res.body.message,
      "Invalid webhook payload"
    );

    assert.equal(
      eventFindOneCalls.length,
      0
    );
  }
);

serialTest(
  "webhook requires event ID after authenticating payload",
  async () => {
    const {
      res,
    } =
      await runWebhook({
        eventId:
          "",
      });

    assert.equal(
      res.statusCode,
      400
    );

    assert.equal(
      res.body.message,
      "Webhook event ID is required"
    );

    assert.equal(
      eventFindOneCalls.length,
      0
    );
  }
);

serialTest(
  "webhook requires event type",
  async () => {
    const {
      res,
    } =
      await runWebhook({
        payload:
          makeCapturedPayload({
            event:
              "   ",
          }),
      });

    assert.equal(
      res.statusCode,
      400
    );

    assert.equal(
      res.body.message,
      "Webhook event type is required"
    );

    assert.equal(
      eventFindOneCalls.length,
      0
    );
  }
);

serialTest(
  "existing webhook event short-circuits ordinary replay before payment side effects",
  async () => {
    existingWebhookEvent = {
      eventId:
        EVENT_ID,

      eventType:
        "payment.captured",

      status:
        "processed",
    };

    const {
      res,
    } =
      await runWebhook();

    assert.equal(
      res.statusCode,
      200
    );

    assert.equal(
      res.body.success,
      true
    );

    assert.equal(
      res.body.duplicate,
      true
    );

    assert.equal(
      purchaseFindCalls.length,
      0
    );

    assert.equal(
      fulfillmentCalls.length,
      0
    );

    assert.equal(
      referralCalls.length,
      0
    );

    assert.equal(
      eventCreateCalls.length,
      0
    );
  }
);

serialTest(
  "non-payment-captured event is recorded as ignored without purchase fulfillment",
  async () => {
    const {
      res,
    } =
      await runWebhook({
        payload:
          makeCapturedPayload({
            event:
              "payment.authorized",
          }),
      });

    assert.equal(
      res.statusCode,
      200
    );

    assert.equal(
      res.body.success,
      true
    );

    assert.equal(
      res.body.ignored,
      true
    );

    assert.equal(
      purchaseFindCalls.length,
      0
    );

    assert.equal(
      fulfillmentCalls.length,
      0
    );

    assert.equal(
      referralCalls.length,
      0
    );

    assert.equal(
      eventCreateCalls.length,
      1
    );

    assert.equal(
      eventCreateCalls[0]
        .eventId,
      EVENT_ID
    );

    assert.equal(
      eventCreateCalls[0]
        .eventType,
      "payment.authorized"
    );

    assert.equal(
      eventCreateCalls[0]
        .status,
      "ignored"
    );
  }
);

serialTest(
  "captured webhook rejects incomplete or non-captured payment entity",
  async () => {
    const {
      res,
    } =
      await runWebhook({
        payload:
          makeCapturedPayload({
            payment: {
              captured:
                false,
            },
          }),
      });

    assert.equal(
      res.statusCode,
      400
    );

    assert.equal(
      res.body.message,
      "Captured payment payload is incomplete"
    );

    assert.equal(
      purchaseFindCalls.length,
      0
    );

    assert.equal(
      fulfillmentCalls.length,
      0
    );
  }
);

serialTest(
  "captured webhook returns 404 when no matching Razorpay purchase exists",
  async () => {
    matchingPurchases = [];

    const {
      res,
    } =
      await runWebhook();

    assert.equal(
      res.statusCode,
      404
    );

    assert.equal(
      res.body.message,
      "Matching payment purchase was not found"
    );

    assert.equal(
      purchaseFindCalls.length,
      1
    );

    assert.deepEqual(
      purchaseFindCalls[0]
        .filter,
      {
        provider:
          "razorpay",

        razorpayOrderId:
          ORDER_ID,
      }
    );

    assert.equal(
      purchaseFindCalls[0]
        .limit,
      2
    );

    assert.equal(
      fulfillmentCalls.length,
      0
    );
  }
);

serialTest(
  "captured webhook rejects ambiguous purchase lookup",
  async () => {
    matchingPurchases = [
      makePurchase(),
      makePurchase({
        _id:
          "507f1f77bcf86cd799439088",
      }),
    ];

    const {
      res,
    } =
      await runWebhook();

    assert.equal(
      res.statusCode,
      409
    );

    assert.equal(
      res.body.message,
      "Payment purchase lookup is ambiguous"
    );

    assert.equal(
      fulfillmentCalls.length,
      0
    );
  }
);

serialTest(
  "captured webhook rejects payment amount mismatch",
  async () => {
    matchingPurchases = [
      makePurchase({
        amountInPaise:
          29900,
      }),
    ];

    const {
      res,
    } =
      await runWebhook();

    assert.equal(
      res.statusCode,
      409
    );

    assert.equal(
      res.body.message,
      "Webhook payment amount mismatch"
    );

    assert.equal(
      fulfillmentCalls.length,
      0
    );
  }
);

serialTest(
  "captured webhook rejects payment currency mismatch",
  async () => {
    matchingPurchases = [
      makePurchase({
        currency:
          "USD",
      }),
    ];

    const {
      res,
    } =
      await runWebhook();

    assert.equal(
      res.statusCode,
      409
    );

    assert.equal(
      res.body.message,
      "Webhook payment currency mismatch"
    );

    assert.equal(
      fulfillmentCalls.length,
      0
    );
  }
);

serialTest(
  "paid purchase cannot be linked to a different Razorpay payment",
  async () => {
    matchingPurchases = [
      makePurchase({
        status:
          "paid",

        razorpayPaymentId:
          OTHER_PAYMENT_ID,
      }),
    ];

    const {
      res,
    } =
      await runWebhook();

    assert.equal(
      res.statusCode,
      409
    );

    assert.equal(
      res.body.message,
      "Purchase is linked to another payment"
    );

    assert.equal(
      fulfillmentCalls.length,
      0
    );

    assert.equal(
      referralCalls.length,
      0
    );
  }
);

serialTest(
  "valid payment.captured webhook hands off once to shared fulfillment referral and processed-event ledger",
  async () => {
    const {
      res,
    } =
      await runWebhook();

    assert.equal(
      res.statusCode,
      200
    );

    assert.equal(
      res.body.success,
      true
    );

    assert.equal(
      res.body.processed,
      true
    );

    assert.equal(
      res.body.alreadyPaid,
      false
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

    const expectedPaidAt =
      new Date(
        CREATED_AT_SECONDS *
          1000
      );

    assert.equal(
      fulfillmentCalls[0]
        .paidAt
        .getTime(),
      expectedPaidAt.getTime()
    );

    assert.equal(
      referralCalls.length,
      1
    );

    assert.equal(
      referralCalls[0]
        .purchase
        .status,
      "paid"
    );

    assert.equal(
      referralCalls[0]
        .purchase
        .razorpayPaymentId,
      PAYMENT_ID
    );

    assert.equal(
      eventCreateCalls.length,
      1
    );

    assert.equal(
      eventCreateCalls[0]
        .eventId,
      EVENT_ID
    );

    assert.equal(
      eventCreateCalls[0]
        .eventType,
      "payment.captured"
    );

    assert.equal(
      eventCreateCalls[0]
        .status,
      "processed"
    );

    assert.equal(
      eventCreateCalls[0]
        .purchaseId,
      PURCHASE_ID
    );

    assert.equal(
      eventCreateCalls[0]
        .razorpayOrderId,
      ORDER_ID
    );

    assert.equal(
      eventCreateCalls[0]
        .razorpayPaymentId,
      PAYMENT_ID
    );
  }
);

serialTest(
  "webhook event duplicate-key race recovers existing event after idempotent payment side effects",
  async () => {
    fulfillmentImpl =
      async ({
        purchase,
        razorpayPaymentId,
        paidAt,
      }) => ({
        purchase: {
          ...purchase,

          status:
            "paid",

          razorpayPaymentId,

          paidAt,
        },

        entitlement: {
          status:
            "active",
        },

        alreadyPaid:
          true,
      });

    eventCreateImpl =
      async (payload) => {
        existingWebhookEvent = {
          _id:
            "507f1f77bcf86cd799439077",
          ...payload,
        };

        const error =
          new Error(
            "controlled webhook event race"
          );

        error.code =
          11000;

        throw error;
      };

    const {
      res,
    } =
      await runWebhook();

    assert.equal(
      res.statusCode,
      200
    );

    assert.equal(
      res.body.success,
      true
    );

    assert.equal(
      res.body.processed,
      true
    );

    assert.equal(
      res.body.alreadyPaid,
      true
    );

    assert.equal(
      fulfillmentCalls.length,
      1
    );

    assert.equal(
      referralCalls.length,
      1
    );

    assert.equal(
      eventCreateCalls.length,
      1
    );

    assert.equal(
      eventDirectAwaitCalls.length,
      1
    );

    assert.deepEqual(
      eventDirectAwaitCalls[0],
      {
        eventId:
          EVENT_ID,
      }
    );
  }
);

test.after(() => {
  Purchase.find =
    ORIGINALS.purchaseFind;

  RazorpayWebhookEvent.findOne =
    ORIGINALS.eventFindOne;

  RazorpayWebhookEvent.create =
    ORIGINALS.eventCreate;

  if (
    ORIGINALS.webhookSecret ===
    undefined
  ) {
    delete process.env
      .RAZORPAY_WEBHOOK_SECRET;
  } else {
    process.env
      .RAZORPAY_WEBHOOK_SECRET =
      ORIGINALS.webhookSecret;
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
    originalReferralCache
  ) {
    require.cache[
      referralServicePath
    ] =
      originalReferralCache;
  } else {
    delete require.cache[
      referralServicePath
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
