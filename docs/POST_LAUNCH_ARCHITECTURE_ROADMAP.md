# PravixoEduTech Post-Launch Architecture Roadmap

**Created:** 29 July 2026
**Status:** Canonical deferred-feature and architecture-preservation index
**Launch checkpoint when created:** `3bf0b1d`

---

## 1. Purpose

This document preserves architectural features, product capabilities,
implementation work and safety requirements that are intentionally not being
completed before the first production launch.

Production-facing pages must contain user-facing product language rather than
temporary engineering notes. Removing such notes from the interface must never
cause deferred features or architecture decisions to be forgotten.

This roadmap is therefore the canonical index for:

- features intentionally disabled for launch;
- features partially implemented;
- features deferred until after launch;
- launch decisions that remain pending;
- completed features whose old development notes may safely be removed;
- architecture rules that future development must not weaken.

---

## 2. Precedence and change control

This roadmap does not replace the detailed architecture locks.

The following documents remain authoritative for their respective domains:

- `docs/PUBLIC_PLATFORM_ARCHITECTURE_LOCK.md`
- `docs/PUBLIC_DOMAIN_ENTITY_RELATIONSHIPS_LOCK.md`
- `docs/PUBLIC_PLATFORM_GAP_AUDIT.md`
- `docs/PUBLIC_CONTENT_ENGINE_LOCK.md`
- `docs/MOCK_TEST_ENGINE_LOCK.md`
- `docs/T44_PAYMENT_MVP_CHECKPOINT.md`
- `docs/T45_REFERRAL_MVP_ARCHITECTURE.md`
- `docs/COMPETITOR_UI_FEATURE_INSPIRATION_LOCK.md`
- `docs/DATABASE_ARCHITECTURE.md`

When this roadmap and a detailed lock appear inconsistent:

1. inspect the implemented source;
2. inspect the latest relevant lock;
3. document the reason for any change;
4. perform security and migration impact review;
5. update the relevant lock and this roadmap together;
6. test, commit and push the reviewed change.

Chat suggestions, hurried launch work or isolated UI changes must not silently
override locked architecture.

---

## 3. Status vocabulary

Every roadmap item must use one of these classifications.

### `LOCKED-COMPLETE`

Implemented and verified for the current MVP. Do not rebuild or redesign it
without a demonstrated security, scalability or exam-rule reason.

### `LAUNCH-DISABLED`

A foundation exists, but public or tenant activation is intentionally disabled
for the first launch.

### `PARTIALLY-IMPLEMENTED`

Models, routes, feature flags or selected workflows exist, but the complete
user-facing lifecycle is not yet ready.

### `POST-LAUNCH-DEFERRED`

Deliberately excluded from the first launch and scheduled for later design,
implementation and UAT.

### `LAUNCH-DECISION-PENDING`

Must be decided before the final launch mode is announced.

### `ARCHITECTURE-GUARDRAIL`

A permanent rule that future implementation must preserve.

### `CANDIDATE-REQUIRES-APPROVAL`

Useful future capability, but not yet approved as committed scope.

---

## 4. Permanent architecture guardrails

The following rules apply to every future module.

### 4.1 Tenant isolation

- Every tenant-owned persistent entity must contain `tenantId`.
- Every protected query and mutation must apply a trusted tenant filter.
- Tenant-scoped uniqueness must be enforced where required.
- Client-supplied tenant identifiers must not be blindly trusted.
- Cross-tenant reads, mutations and object population must be tested.

**Status:** `ARCHITECTURE-GUARDRAIL`

### 4.2 Role and object-level authorization

Preserve the existing role boundaries:

- `super_admin`
- `tenant_admin`
- `content_admin`
- `student`

Route protection alone is not sufficient. Object ownership, tenant scope and
allowed action must be checked by the backend.

**Status:** `ARCHITECTURE-GUARDRAIL`

### 4.3 One-device student session rule

A successful student login replaces the previous `activeSessionId`.
Requests carrying an older session ID must continue to receive `401`.

Future mobile applications, OTP login and password recovery must integrate with
this rule deliberately rather than accidentally bypassing it.

**Status:** `LOCKED-COMPLETE` and `ARCHITECTURE-GUARDRAIL`

### 4.4 Immutable published test snapshots

- Editable `MockTest` records remain drafts.
- Published attempts use `MockTestVersion`.
- Published versions preserve settings, sections, questions, groups and labels.
- Historical attempts and results must not depend on mutable live records.
- Used versions and completed attempts must not be destructively rewritten.

**Status:** `LOCKED-COMPLETE` and `ARCHITECTURE-GUARDRAIL`

### 4.5 Secure scoring and answer protection

- Correct answers and protected explanations must not leak before submission.
- Scoring must be calculated by the backend.
- Students may access only their own attempts.
- Attempt limits, expiry, pause/resume and post-submit restrictions remain
  server-enforced.

**Status:** `LOCKED-COMPLETE` and `ARCHITECTURE-GUARDRAIL`

### 4.6 Additive migration policy

New public-domain relationships must initially be additive.

Existing fields, URLs and records must not be removed until:

- compatibility is proved;
- migration is complete;
- redirects and canonicals are planned;
- historical snapshots remain readable;
- rollback is available.

**Status:** `ARCHITECTURE-GUARDRAIL`

### 4.7 Payment and entitlement integrity

- The backend verifies the payment provider response.
- Entitlement unlock must follow verified payment.
- Paid purchase and entitlement fulfilment must remain atomic or safely
  self-healing.
- Published paid-test commercial fields remain protected.
- Duplicate payment replay must not create inconsistent access.

**Status:** `LOCKED-COMPLETE` and `ARCHITECTURE-GUARDRAIL`

### 4.8 Referral must not weaken payment fulfilment

Referral processing must never prevent a verified paid student from receiving
the purchased entitlement.

Referral reward creation, fraud review and wallet processing remain separate
from the core payment success guarantee.

**Status:** `ARCHITECTURE-GUARDRAIL`

### 4.9 Human editorial control

AI-assisted content may support drafting, classification or analysis, but must
not auto-publish without human editorial review.

Accuracy, sources, originality, permissions, tenant isolation and auditability
must be preserved.

**Status:** `ARCHITECTURE-GUARDRAIL`

---

## 5. Current launch-scope classification

### 5.1 Content administration

Current implementation includes:

- content listing and filtering;
- content creation;
- content editing;
- draft and published status handling;
- category creation and management;
- public preview for published records.

Old UI notes claiming these controls will be added later are obsolete.

**Status:** `LOCKED-COMPLETE`

### 5.2 Site promotions

The promotion system supports:

- placement;
- status;
- priority;
- date scheduling;
- internal CTA paths;
- activation and deactivation;
- fallback hero behaviour.

The highest-priority eligible active promotion is intended to win its
placement. UI wording that says this will happen “later” is obsolete where the
implemented behaviour has been verified.

**Status:** `LOCKED-COMPLETE` for the current promotion MVP

### 5.3 Current Mock Test MVP

The current single-correct MCQ engine includes:

- Exam Patterns;
- Question Bank;
- Question Groups and stimulus snapshots;
- Mock Test draft and publishing;
- frozen published versions;
- student start, resume and submit;
- result and detailed review;
- attempt history;
- attempt limits;
- paid access checks;
- security and ownership checks.

Do not rebuild this foundation when adding advanced test types.

**Status:** `LOCKED-COMPLETE`

### 5.4 Payment MVP

Implemented foundation includes:

- payment products/packages;
- Razorpay order creation;
- backend payment verification;
- purchases;
- entitlements;
- student paid-access enforcement;
- admin purchase ledger;
- atomic/self-healing fulfilment hardening.

The verified production UAT used Razorpay Test Mode.

**Status:** `LOCKED-COMPLETE` for Test Mode
**Live mode:** `LAUNCH-DECISION-PENDING`

### 5.5 Referral MVP foundation

The repository already contains substantial referral foundations, including:

- referral partners;
- referral codes;
- student attribution;
- referral settings;
- reward records;
- withdrawal-related workflows;
- admin referral workspace;
- tenant feature checks;
- payment integration points.

It must not be described as completely unbuilt.

Final activation, end-to-end production UAT, fraud controls and selected
advanced workflows remain pending.

**Status:** `PARTIALLY-IMPLEMENTED` and currently launch-controlled

### 5.6 Public registration

Public registration routes exist behind
`requirePublicRegistrationAvailable`.

The current deliberate response is:

`Registration is currently unavailable`

This is an intentional launch gate, not an accidental missing route.

**Status:** `LAUNCH-DISABLED`

---

## 6. Launch decisions still pending

These decisions must be made only after all other launch inspections pass.

### 6.1 Paid launch mode

Choose one:

1. real paid launch with Razorpay live credentials and controlled live UAT; or
2. beta/free launch with purchasing disabled or hidden.

Before real paid launch:

- configure live credentials securely;
- perform one controlled live payment;
- confirm paid ledger status;
- confirm active entitlement;
- confirm payment visibility in Razorpay;
- verify cancellation and failed-payment behaviour;
- verify operational support procedure.

**Status:** `LAUNCH-DECISION-PENDING`

### 6.2 Contact information

Official public support email:

`pravixoedutech@gmail.com`

No public phone number will be displayed at first launch.
A phone number may be added later after the official support process is ready.

**Status:** Email approved; phone `POST-LAUNCH-DEFERRED`

### 6.3 Referral launch activation

Referral data and workflows must remain controlled until final referral UAT,
fraud review and launch decision are complete.

**Status:** `LAUNCH-DECISION-PENDING`

---

## 7. Post-launch student account roadmap

### 7.1 Self-registration

Deferred lifecycle:

- student registration form;
- tenant-safe registration resolution;
- mobile/email validation;
- duplicate-account rules;
- referral-code capture;
- password policy;
- consent and policy acknowledgement;
- abuse and rate-limit protection.

Must integrate with one-device sessions and tenant isolation.

**Priority:** Post-launch P0
**Status:** `POST-LAUNCH-DEFERRED`

### 7.2 OTP verification

Deferred lifecycle:

- OTP generation;
- expiry;
- retry and resend limits;
- brute-force protection;
- provider failure handling;
- verification status;
- audit logging;
- secure account activation.

**Priority:** Post-launch P0
**Status:** `POST-LAUNCH-DEFERRED`

### 7.3 Password recovery and account recovery

Deferred lifecycle:

- forgot-password flow;
- verified reset mechanism;
- forced invalidation of old sessions;
- recovery abuse protection;
- support escalation path.

**Priority:** Post-launch P0
**Status:** `POST-LAUNCH-DEFERRED`

### 7.4 Student profile and personalization

Future capabilities may include:

- preferred language;
- primary exam;
- target attempt/date;
- preparation stage;
- daily availability;
- saved exams;
- bookmarks;
- saved content;
- notifications;
- alerts;
- transaction history;
- subscription and entitlement clarity;
- account and privacy controls.

These must be implemented as shared, reusable account capabilities rather than
page-specific shortcuts.

**Priority:** Post-launch P1
**Status:** `POST-LAUNCH-DEFERRED`

---

## 8. Advanced Mock Test roadmap

### 8.1 Descriptive tests

Preserve the existing feature foundation while adding:

- descriptive question authoring;
- answer editor;
- word limits;
- timed submission;
- evaluation workflow;
- marks and feedback;
- moderation;
- result and review visibility rules.

**Priority:** Post-launch P1
**Status:** `PARTIALLY-IMPLEMENTED` foundation,
`POST-LAUNCH-DEFERRED` complete engine

### 8.2 Typing and CPCT tests

Deferred capabilities:

- English typing;
- Hindi typing;
- passage snapshots;
- typing attempt detail;
- speed and accuracy;
- error calculation;
- timer and submission;
- result and review;
- browser compatibility;
- anti-cheating rules where appropriate.

Must extend the existing snapshot-based attempt lifecycle.

**Priority:** Post-launch P1
**Status:** `PARTIALLY-IMPLEMENTED` foundation,
`POST-LAUNCH-DEFERRED` complete engine

### 8.3 Additional question modes

Before activation, inspect and complete the existing foundations for:

- numerical questions;
- multi-correct questions;
- richer mathematical content;
- advanced table/image stimulus;
- exam-specific input rules.

Do not weaken pre-submit answer protection.

**Priority:** Post-launch P1
**Status:** `PARTIALLY-IMPLEMENTED` or feature-controlled,
subject to implementation verification

### 8.4 PYQ and analytics expansion

Future work:

- Exam, Stage, Year, Shift and Paper as first-class metadata;
- topic and difficulty analysis;
- weak-topic recommendations;
- attempted/remaining progress;
- recommended next action;
- safe cross-linking with public exam and study entities.

**Priority:** Post-launch P1
**Status:** `POST-LAUNCH-DEFERRED`

---

## 9. Public platform architecture roadmap

The current generic Content foundation must remain operational throughout
migration.

### 9.1 Structured Exam entity

Implement the locked Exam model and relationships without breaking existing
Content URLs or records.

**Status:** `POST-LAUNCH-DEFERRED`

### 9.2 Organization entity

Implement exam-conducting bodies, departments, institutions and related
organization metadata with tenant-scoped uniqueness.

**Status:** `POST-LAUNCH-DEFERRED`

### 9.3 Shared taxonomy

Implement reusable:

- exam;
- subject;
- topic;
- subtopic;
- state;
- stage;
- content relationships.

Existing text fields must not be deleted until migration is complete.

**Status:** `POST-LAUNCH-DEFERRED`

### 9.4 Recruitment and Recruitment Event lifecycle

Implement structured recruitment entities and dated lifecycle events for:

- notification;
- application;
- correction window;
- admit card;
- exam date;
- answer key;
- result;
- further stages.

**Status:** `POST-LAUNCH-DEFERRED`

### 9.5 Sources, contributors and verification

Implement structured official sources, verification status, contributor and
reviewer attribution, correction history and audit-compatible publishing.

**Status:** `POST-LAUNCH-DEFERRED`

### 9.6 Bilingual public architecture

Implement the locked hybrid bilingual strategy with stable canonical entities,
translation grouping and deliberate URL strategy.

Do not duplicate mutable business identity merely to provide translations.

**Status:** `POST-LAUNCH-DEFERRED`

### 9.7 Purpose-built public templates

Future templates include:

- Exam hubs;
- Recruitment detail;
- Study detail;
- Current-affairs detail;
- related questions;
- related Mock Tests;
- internal linking;
- structured source display.

**Status:** `POST-LAUNCH-DEFERRED`

### 9.8 Search, sitemap and listing scale

Resolve the audited scale limitations, including:

- sitemap limits;
- public search result limits;
- listing-page limits;
- pagination;
- scalable route discovery;
- canonical and structured-data verification.

**Priority:** Post-launch P0/P1
**Status:** `POST-LAUNCH-DEFERRED`

---

## 10. Referral roadmap

Preserve the existing referral foundation.

### 10.1 Required activation work

Before enabling referrals broadly:

- full registration/referral attribution UAT;
- paid conversion UAT;
- duplicate and self-referral testing;
- reward safety-window testing;
- tenant isolation tests;
- admin approval/rejection testing;
- withdrawal state testing;
- payment failure and refund impact review;
- operational fraud review.

**Status:** `PARTIALLY-IMPLEMENTED`

### 10.2 Post-launch hardening

Future capabilities:

- KYC workflow;
- payout evidence;
- wallet reconciliation;
- fraud signals;
- suspicious-pattern review;
- exports and reporting;
- partner communication;
- payout automation only after manual controls prove safe.

**Status:** `POST-LAUNCH-DEFERRED`

### 10.3 Explicitly excluded until separately approved

- multi-level referral trees;
- uncontrolled automatic payouts;
- reward rules that can block student entitlement;
- client-controlled commission calculations.

**Status:** `CANDIDATE-REQUIRES-APPROVAL` or prohibited without review

---

## 11. Payment roadmap

### 11.1 Live payment activation

This belongs to the final launch decision, not ordinary post-launch expansion.

**Status:** `LAUNCH-DECISION-PENDING`

### 11.2 Future payment capabilities

Possible later work includes:

- refunds and reversal workflows;
- payment reconciliation;
- provider webhook processing;
- invoices and tax documents;
- subscription and renewal models;
- coupons and approved discounts;
- payment exports;
- financial audit tooling.

Each capability requires a separate security, accounting and entitlement-impact
design.

**Status:** `CANDIDATE-REQUIRES-APPROVAL`

---

## 12. LMS and course-delivery roadmap

The tenant model currently preserves an LMS feature foundation, but a complete
LMS is not part of the first launch.

Future scope may include:

- courses;
- batches;
- recorded lessons;
- live classes;
- lesson resources;
- attendance;
- progress;
- assignments;
- certificates;
- instructor roles;
- course entitlements;
- expiry;
- learner dashboard integration.

LMS access must reuse tenant isolation, authorization and entitlement
principles rather than creating a separate insecure access system.

**Priority:** Post-launch P2
**Status:** `POST-LAUNCH-DEFERRED`

---

## 13. SaaS and multi-tenant expansion

Future SaaS work may include:

- trusted domain/subdomain tenant resolution;
- institute onboarding;
- plan and feature management;
- tenant branding;
- tenant administrator workflows;
- role-management improvements;
- tenant billing;
- data export;
- audit logs;
- controlled support access.

Every addition must preserve tenant filters, tenant-scoped uniqueness and safe
super-admin behaviour.

**Priority:** Post-launch P2
**Status:** `POST-LAUNCH-DEFERRED`

---

## 14. Mobile, PWA and notifications

Potential future capabilities:

- PWA;
- mobile applications;
- push notifications;
- saved offline content where legally and technically appropriate;
- exam and recruitment alerts;
- attempt reminders;
- entitlement-expiry reminders.

The same backend security and one-device-session policy must be deliberately
adapted for mobile rather than bypassed.

**Status:** `CANDIDATE-REQUIRES-APPROVAL`

---

## 15. AI-assisted capabilities

Possible future uses:

- editorial drafting assistance;
- metadata suggestions;
- topic classification;
- question-generation assistance;
- explanation drafting;
- learner recommendations;
- search assistance.

Permanent restriction:

No AI-generated public content, question, answer, explanation or correction may
auto-publish without authorized human review.

**Status:** `CANDIDATE-REQUIRES-APPROVAL`

---

## 16. Production-copy cleanup register

The following UI notes may be removed or rewritten only because their meaning
is preserved here.

### Contact page

Replace launch placeholders with:

- `pravixoedutech@gmail.com`;
- no public phone;
- no unapproved office details.

### Admin Payment Packages

Remove the false statement that Razorpay checkout is not connected.

Use environment-neutral admin copy until the final paid-launch mode is decided.

### Content Manager

Remove development-step notes claiming content creation, editing, publishing
and category controls are not available.

Replace empty-state text with current operational wording.

### Site Promotions

Replace future-tense selection wording with current priority behaviour after
verification.

### Student Login

Remove `Registration/OTP will be added later` from the production UI.

Registration and OTP remain preserved in Sections 7.1 and 7.2 of this roadmap.

### Student payment packages

Keep the explicit Razorpay Test Mode wording until the final launch-payment
decision is completed.

---

## 17. Recommended post-launch implementation order

Subject to production incidents and business priority:

1. launch stabilization and monitoring;
2. public registration, OTP and account recovery;
3. audited public search, listing and sitemap scale fixes;
4. structured Exam, Organization and taxonomy foundation;
5. Recruitment and Recruitment Event lifecycle;
6. purpose-built public/admin workflows and templates;
7. advanced Mock Test modes;
8. referral activation and fraud hardening;
9. student personalization and alerts;
10. LMS and course delivery;
11. mobile/PWA;
12. carefully governed AI assistance.

Security defects, data-integrity defects and production incidents always take
priority over roadmap sequence.

---

## 18. Mandatory workflow for every roadmap item

Before implementation:

1. inspect current source and relevant lock;
2. classify the item accurately;
3. document scope and non-scope;
4. identify dependencies;
5. identify tenant and security impact;
6. define migration and rollback;
7. define acceptance criteria.

During implementation:

1. make minimal additive changes;
2. protect completed modules;
3. preserve tenant isolation;
4. preserve historical snapshots;
5. test unauthorized and cross-tenant access;
6. run syntax/build validation;
7. inspect the diff.

After implementation:

1. perform browser/API UAT;
2. update relevant architecture locks;
3. update this roadmap status;
4. commit with a focused message;
5. push and verify deployment;
6. preserve a resume checkpoint.

---

## 19. Roadmap maintenance rule

Whenever a production-facing development note is removed:

- confirm the feature is complete; or
- record the deferred feature in this roadmap.

Whenever a roadmap feature is completed:

- change its status;
- record the relevant commit;
- update the detailed lock;
- remove obsolete future wording from the UI.

This document must remain an active architecture index rather than an abandoned
TODO list.
