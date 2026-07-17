# T-44 Payment MVP Checkpoint

Last updated: 2026-07-16
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

## Next step
T-44K Final Payment MVP smoke test.
After T-44K passes, move to Referral MVP.

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

Payment MVP is locked. Next module: Referral MVP.
