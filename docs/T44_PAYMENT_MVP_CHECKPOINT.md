# T-44 Payment MVP Checkpoint

Last updated: 2026-08-07
Branch: feature/question-group-stimulus-support

## Scope locked
T-44 completed the first paid product flow:
Student login -> paid packages -> Razorpay order -> checkout -> backend verification -> paid purchase -> entitlement -> paid mock test access.

Referral is not included in T-44. Referral starts after payment foundation is stable.

## Completed payment modules
- PaymentProduct, Purchase, Entitlement models
- Admin Payment Packages API and UI
- Student paid package listing
- Razorpay order creation API
- Razorpay Checkout UI
- Razorpay signature verification
- Entitlement unlock after successful payment
- Paid mock test access guard
- Duplicate active package purchase prevention
- Purchased package UX
- Admin Payment Ledger API and UI
- Razorpay checkout prefill sanitized
- Signed Razorpay payment.captured webhook endpoint
- Raw-body webhook HMAC verification with dedicated webhook secret
- Razorpay webhook event persistence and event-ID idempotency

## Backend APIs
Admin:
GET /api/payment-products
POST /api/payment-products
GET /api/payment-products/:id
PUT /api/payment-products/:id
PATCH /api/payment-products/:id/disable
PATCH /api/payment-products/:id/reactivate
GET /api/payment-products/purchases

Student:
GET /api/student/payment-packages
POST /api/student/payment-packages/:productId/create-order
POST /api/student/payment-packages/verify-payment

## Frontend pages
/admin/payment-packages
/admin/payment-purchases
/student/mock-tests

## Safety rules locked
- Frontend sends only package/product id.
- Backend decides price.
- Razorpay order is created by backend.
- Access unlocks only after backend signature verification.
- Paid mock test start checks active entitlement.
- Duplicate active package purchase is blocked.
- Razorpay keys remain in backend env only.
- Razorpay webhook secret remains backend-only and separate from RAZORPAY_KEY_SECRET.
- Webhook raw-body route must remain mounted before express.json().

## Cleanup completed
- T44B Proof Mock Test Pack disabled in DB.
- Checkout prefill keeps name, email, and valid 10-digit mobile only.
- profile.phone/profile.contact fallback removed.

## Current active packages
- BSR Package
- MPPSC and UPPSC prelims combo pack

## Important test data note
Existing duplicate paid BSR purchases are retained as test-mode proof data.
Future duplicate active package purchases are blocked by backend guard.

## Verified proof
- Razorpay test order created.
- Fake signature rejected.
- Netbanking test success accepted.
- Purchase marked paid.
- Entitlement created.
- Purchased package shows Access Active.
- Admin ledger shows purchases, status, Razorpay IDs, entitlement validity.
- Razorpay Test Mode webhook registered for payment.captured only.
- Controlled BSR Package payment produced one paid purchase and one active entitlement.
- Production Railway proof confirmed one processed payment.captured webhook with matching Razorpay order/payment IDs.
- Exactly one payment.captured webhook record was stored for the controlled purchase; no duplicate entitlement was created.

## T-44 commit log
- 959f885 Add payment product purchase entitlement models
- cb3c668 Add admin payment product API
- a5ecbcd Align payment tenant IDs with slug-based tenancy
- e1db8fc Add admin payment packages UI
- 1126bed Organize admin dashboard sidebar sections
- 7358427 Add student payment package listing API
- 03c4969 Add student payment package listing UI
- c4f1099 Install Razorpay backend SDK
- d434abe Add student Razorpay order creation API
- 56252f5 Add Razorpay payment verification and entitlement unlock
- a575305 Connect Razorpay Checkout on student package UI
- 8d030d1 Add purchased package access state
- f4e80a6 Add admin payment purchase ledger API
- 3f37bee Add admin payment ledger UI
- fb2040c Sanitize Razorpay checkout prefill
- fce7a65 Add signed Razorpay webhook processing

## T-44K Final Payment MVP Smoke Test

Status: PASSED

Verified:
- Active packages DB proof shows only BSR Package and MPPSC/UPPSC combo pack.
- T44B Proof Mock Test Pack is hidden from student package list.
- Student Golu has active BSR Package entitlement.
- Student package list returns BSR Package as active and MPPSC/UPPSC as not_purchased.
- Duplicate BSR create-order is blocked with 409.
- Admin payment ledger returns 200.
- Paid ledger filter returns only paid purchases.
- Working tree clean after final smoke.

Payment MVP is locked.

## T-44A Signed Razorpay Webhook Production Verification

Status: PASSED

Verified:
- Webhook code deployed successfully to the Railway production backend.
- RAZORPAY_WEBHOOK_SECRET configured only in Railway.
- Unsigned live webhook probe returned HTTP 401 as expected.
- Razorpay Test Mode webhook is enabled for payment.captured.
- Controlled INR 199 BSR Package payment completed successfully.
- Purchase status is paid with Razorpay order and payment IDs.
- Exactly one active entitlement exists for the controlled purchase.
- Exactly one payment.captured webhook record exists for the controlled purchase with status processed.
- Webhook order ID and payment ID match the paid purchase.
- Referral outcome was checked; this controlled purchase created no referral reward.
- Read-only production diagnostic performed no database writes.
- Package entitlement does not override the Mock Test attempt limit; the existing test correctly remains 25/25 with 0 remaining.

## Next step

Continue T-45 Referral MVP from the existing referral architecture and implementation checkpoint.
After Referral is stabilized, continue Mock Test completion, Student Dashboard/UI improvement, and measured loading-performance optimization.
