# T-45 Referral MVP Architecture

Branch: feature/question-group-stimulus-support

## Locked Goal
Build a safe Referral MVP after Payment MVP is locked.

Referral should track promoter code, student attribution, paid purchase conversion, pending commission, admin review, and wallet withdrawal requests under admin-editable rules.

## Previous Discussion Carried Forward
- Referral/promoter system is for libraries, cyber cafes, teachers, students, coaching centers, influencers, and local partners.
- Referral should support growth without weakening payment security.
- Payment/referral money systems need strict fraud checks.
- Admin must control approval, rejection, payout status, and withdrawal rules.
- No automatic payout in MVP.

## MVP Includes
- Promoter / referral code
- Student attribution
- Paid purchase conversion
- Commission/reward ledger as pending
- Admin review
- Wallet withdrawal request with admin-editable conditions

## MVP Excludes
- Automatic payout
- Bank transfer automation
- UPI payout automation
- Instant withdrawal
- Multi-level referral tree
- Coupon/discount engine

## Core Models Planned

### ReferralPartner
- tenantId
- name
- mobile
- email
- promoterType: library / cyber_cafe / coaching / teacher / student / influencer / partner / other
- code
- status: pending / active / suspended / rejected
- commissionType: flat / percentage
- commissionValue
- walletBalanceInPaise
- totalEarnedInPaise
- totalWithdrawnInPaise
- notes
- createdBy
- updatedBy

### ReferralAttribution
- tenantId
- studentId
- referralPartnerId
- referralCode
- source: register / checkout / admin
- attributedAt
- lockedAt
- status: active / cancelled

### ReferralReward
- tenantId
- referralPartnerId
- studentId
- purchaseId
- productId
- purchaseAmountInPaise
- rewardAmountInPaise
- status: pending / approved / rejected / withdrawal_requested / paid / reversed
- eligibleAt
- approvedAt
- rejectedAt
- withdrawalRequestedAt
- paidAt
- reversedAt
- adminNote

### WithdrawalRequest
- tenantId
- referralPartnerId
- amountInPaise
- status: requested / approved / rejected / paid / cancelled
- payoutMethod: upi / bank / cash / other
- upiId
- bankDetailsSnapshot
- requestedAt
- approvedAt
- rejectedAt
- paidAt
- adminNote

### ReferralSettings
- tenantId
- minimumWithdrawalAmountInPaise
- rewardLockDays
- refundSafetyDays
- kycRequired
- upiRequired
- bankRequired
- maxWithdrawalAmountPerMonthInPaise
- allowStudentPromoterWithdrawal
- manualApprovalRequired
- isReferralEnabled
- updatedBy

## Safety Rules
- No self-referral.
- No same-mobile/email abuse.
- No commission until purchase is paid.
- Reward is created only after Purchase.status is paid.
- Reward starts as pending.
- Admin approves or rejects reward manually.
- Wallet withdrawal is allowed only under admin-editable conditions.
- Admin manually approves/rejects withdrawal.
- Admin manually marks withdrawal as paid.
- Reward creation must not block entitlement unlock.
- No automatic payout in MVP.

## Payment Integration Point
ReferralReward should be created after Razorpay verification succeeds and purchase becomes paid.

Current payment verification already creates Entitlement after Razorpay verification. Referral reward creation should be added after entitlement creation, but it must not block entitlement if reward creation fails.

## Admin Pages Planned
- /admin/referral-partners
- /admin/referral-rewards
- /admin/referral-withdrawals
- /admin/referral-settings

## Safe Build Order
1. Add referral models only.
2. Add admin Referral Partner API.
3. Add admin Referral Partner UI.
4. Add referral code capture during student registration.
5. Add attribution proof.
6. Add reward creation after paid purchase.
7. Add admin reward ledger.
8. Add withdrawal request API.
9. Add admin withdrawal review.
10. Add referral settings.
11. Final referral smoke test.

## First Code Step
T-45B Step 1: Add referral data models only.

Models only. No route changes. No payment flow changes in first code step.
