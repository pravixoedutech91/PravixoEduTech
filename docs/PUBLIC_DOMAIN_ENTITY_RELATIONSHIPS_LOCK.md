# PravixoEduTech Public Domain Entity Relationships Lock

**Status:** Locked domain relationship design
**Phase:** T-45W Step 4A - Public Domain Entity Relationships
**Architecture lock commit:** `3f9ff16`
**Gap audit commits:** `4930e62`, `178d477`
**Branch:** `feature/question-group-stimulus-support`
**Actual Next.js route root:** `frontend/app`

---

## 1. Purpose

This document locks the public-domain entities and their relationships before schema implementation.

It defines:

- Organization;
- Exam;
- shared Subject, Topic and Subtopic taxonomy;
- Recruitment;
- Recruitment Event;
- official Source records;
- verification metadata;
- Contributor profiles for authors and reviewers;
- Content relationships;
- Question and Question Group relationships;
- Exam Pattern relationships;
- Mock Test and published-version relationships;
- bilingual relationships;
- compatibility with existing Content records.

No schema or API implementation should begin until this document is reviewed, committed and pushed.

---

## 2. Core design rules

### 2.1 Preserve completed systems

The existing systems must remain operational during public-domain expansion:

- authentication;
- role authorization;
- tenant isolation;
- Category management;
- generic Content CRUD;
- Question Bank;
- Question Groups;
- Exam Patterns;
- Mock Tests;
- Mock Test Version snapshots;
- student attempts;
- results and review;
- payments;
- referrals.

New relationships must be additive first. Destructive migration is prohibited until compatibility has been proved.

### 2.2 Tenant ownership is mandatory

Every new persistent public-domain entity must contain `tenantId`.

Every reference accepted through an admin API must be validated against the target tenant.

A valid ObjectId is not sufficient. The referenced entity must also:

- exist;
- belong to the same tenant;
- be active or otherwise allowed for the requested operation.

Super-admin operations must use an explicit target tenant. They must not silently mix records from different tenants.

### 2.3 Explicit relationships are preferred

Phase 1 must use explicit typed ObjectId relationships rather than a generic polymorphic relationship engine.

Examples:

- `organizationId`;
- `examIds`;
- `subjectId`;
- `topicId`;
- `subtopicId`;
- `recruitmentId`;
- `recruitmentEventId`;
- `sourceIds`;
- `relatedMockTestIds`.

A generic `EntityRelation` collection is not approved for the initial implementation because it would increase tenant-validation, indexing and referential-integrity risk.

### 2.4 Historical test data must remain stable

Published Mock Test Versions and completed attempts must not depend on mutable labels alone.

When taxonomy and Exam relationships are introduced:

- drafts may reference live entities;
- published versions must snapshot identifiers and display labels;
- completed attempt results must remain readable even if taxonomy labels later change.

### 2.5 Existing public URLs must remain valid

Current public Content routes must remain operational during migration.

Structured entities may eventually become canonical, but existing URLs must be preserved through:

- linking;
- canonical policy;
- redirects where appropriate;
- legacy compatibility records;
- sitemap transition rules.

URL policy will be locked separately in T-45W Step 5.

---

## 3. Entity overview

Locked core entities:

```text
Tenant
  |
  +-- Organization
  |
  +-- Exam
  |
  +-- TaxonomyNode
  |     +-- subject
  |     +-- topic
  |     +-- subtopic
  |
  +-- Recruitment
  |     +-- RecruitmentEvent
  |
  +-- SourceRecord
  |
  +-- ContributorProfile
  |
  +-- Content
  |
  +-- Category
  |
  +-- QuestionGroup
  |
  +-- Question
  |
  +-- ExamPattern
  |
  +-- MockTest
        +-- MockTestVersion
              +-- TestAttempt
```

Logical preparation path:

```text
Organization
      |
      v
Exam
      |
      +---- Subject ---- Topic ---- Subtopic
      |                         |
      |                         +---- Content
      |                         +---- Question
      |                         +---- QuestionGroup
      |                         +---- MockTest coverage
      |
      +---- Recruitment ---- RecruitmentEvent
      |
      +---- ExamPattern
      |
      +---- MockTest ---- MockTestVersion ---- Attempt analytics
```

---

## 4. Organization entity

### 4.1 Purpose

Organization represents an official or educational body that conducts exams, publishes notices or runs recruitments.

Examples:

- Madhya Pradesh Public Service Commission;
- Madhya Pradesh Employees Selection Board;
- Staff Selection Commission;
- Institute of Banking Personnel Selection;
- Railway Recruitment Board;
- Union Public Service Commission.

### 4.2 Locked fields

Conceptual fields:

```text
tenantId
name.en
name.hi
shortName
slug
aliases[]
organizationType
jurisdictionType
stateCode
countryCode
officialWebsiteUrl
logoUrl
description.en
description.hi
isVerified
status
sourceIds[]
createdBy
updatedBy
timestamps
```

Suggested `organizationType` values:

```text
exam_authority
recruiting_body
government_department
university
board
commission
banking_body
railway_body
other
```

Suggested `jurisdictionType` values:

```text
national
state
regional
institutional
other
```

### 4.3 Relationships

```text
Organization 1 ---- many Exam
Organization 1 ---- many Recruitment
Organization 1 ---- many SourceRecord
```

An Exam should normally have one primary conducting Organization.

A Recruitment must have one recruiting Organization.

### 4.4 Uniqueness and indexes

Required direction:

```text
unique: tenantId + slug
index:  tenantId + status
index:  tenantId + shortName
index:  tenantId + organizationType
```

Organization name alone must not be globally unique because names and abbreviations may vary.

---

## 5. Exam entity

### 5.1 Purpose

Exam is the canonical evergreen identity for a competitive examination.

It must not be represented only by a generic Content article.

### 5.2 Locked fields

Conceptual fields:

```text
tenantId
organizationId
name.en
name.hi
shortName
slug
aliases[]
examFamily
scope
stateCode
level
officialWebsiteUrl
description.en
description.hi
defaultLanguageCodes[]
status
subjectLinks[]
examPatternLinks[]
sourceIds[]
verification
seo
createdBy
updatedBy
timestamps
```

Suggested `scope` values:

```text
national
state
regional
institutional
```

Suggested `status` values for the entity itself:

```text
active
inactive
archived
```

Recruitment-cycle status must not be stored as the Exam entity status.

### 5.3 Subject links

Exam-to-subject is many-to-many.

The Exam record may contain ordered subject-link subdocuments:

```text
subjectLinks: [
  {
    subjectId,
    displayOrder,
    sectionLabel.en,
    sectionLabel.hi,
    isCore,
    isActive
  }
]
```

This allows one canonical Subject to appear in many Exams while preserving exam-specific order and labels.

### 5.4 Exam Pattern links

The existing Mock Test `ExamPattern` model remains separate.

Exam may reference one or more patterns:

```text
examPatternLinks: [
  {
    examPatternId,
    stageKey,
    stageLabel.en,
    stageLabel.hi,
    isPrimary,
    displayOrder
  }
]
```

This connects evergreen Exam information to the existing test engine without merging the two models.

### 5.5 Relationships

```text
Organization 1 ---- many Exam
Exam many ---- many Subject
Exam 1 ---- many Recruitment
Exam many ---- many Content
Exam many ---- many Question
Exam many ---- many QuestionGroup
Exam many ---- many ExamPattern
Exam 1 ---- many MockTest
```

### 5.6 Uniqueness and indexes

Required direction:

```text
unique: tenantId + slug
index:  tenantId + organizationId
index:  tenantId + examFamily
index:  tenantId + stateCode
index:  tenantId + status
```

---

## 6. Shared taxonomy entity

### 6.1 Locked decision

Subject, Topic and Subtopic will be logical levels of one hierarchical collection:

```text
TaxonomyNode
```

This avoids three disconnected collections and supports consistent identity across Content, Questions, Mock Tests and analytics.

### 6.2 Node kinds

```text
subject
topic
subtopic
```

### 6.3 Locked fields

Conceptual fields:

```text
tenantId
kind
parentId
name.en
name.hi
slug
canonicalKey
aliases.en[]
aliases.hi[]
description.en
description.hi
displayOrder
status
createdBy
updatedBy
timestamps
```

### 6.4 Hierarchy rules

```text
subject  -> parentId must be null
topic    -> parentId must reference a subject
subtopic -> parentId must reference a topic
```

The application must validate hierarchy type, not only tenant ownership.

A Subtopic cannot directly reference a Subject.

### 6.5 Canonical identity

`canonicalKey` provides a stable machine identity independent of display language.

Example:

```text
kind: subject
canonicalKey: indian-polity
name.en: Indian Polity
name.hi: भारतीय राजव्यवस्था
```

Hindi and English names are labels of one concept, not separate taxonomy records.

### 6.6 Uniqueness and indexes

Required direction:

```text
unique: tenantId + canonicalKey
unique: tenantId + kind + parentId + slug
index:  tenantId + kind + status
index:  tenantId + parentId + displayOrder
```

### 6.7 Relationship behavior

A Content, Question or Mock Test relationship may store:

```text
subjectId
topicId
subtopicId
```

When multiple levels are present:

- Topic must belong to Subject.
- Subtopic must belong to Topic.
- All nodes must belong to the same tenant.

The API must reject inconsistent taxonomy paths.

---

## 7. Recruitment entity

### 7.1 Purpose

Recruitment represents one complete recruitment cycle or advertisement.

It is not a generic vacancy article.

Examples:

```text
MPPSC State Service Examination 2026
SSC CGL 2026
IBPS PO 2026
MPESB Group 2 Sub Group 3 Recruitment 2026
```

### 7.2 Locked fields

Conceptual fields:

```text
tenantId
organizationId
examId
title.en
title.hi
slug
advertisementNumber
cycleLabel
recruitmentYear
applicationMode
scope
stateCodes[]
locationText.en
locationText.hi
totalVacancies
posts[]
qualificationSummary.en
qualificationSummary.hi
ageRules
feeStructure[]
salarySummary.en
salarySummary.hi
selectionProcess[]
importantDates
officialNotificationSourceId
officialApplyUrl
currentStatus
publicationStatus
sourceIds[]
verification
seo
createdBy
updatedBy
timestamps
```

### 7.3 Post structure

Posts should be structured subdocuments for the initial implementation:

```text
posts: [
  {
    postKey,
    name.en,
    name.hi,
    vacancyCount,
    categoryBreakdown,
    qualification.en,
    qualification.hi,
    ageMinimum,
    ageMaximum,
    payLevel,
    salaryText.en,
    salaryText.hi
  }
]
```

A separate RecruitmentPost collection is not approved initially. It may be reconsidered only if post-level scale or query requirements justify it.

### 7.4 Important dates

Recruitment may contain summary dates used for fast cards and filtering:

```text
importantDates: {
  notificationDate,
  applicationStartDate,
  applicationEndDate,
  feePaymentEndDate,
  correctionStartDate,
  correctionEndDate,
  examDateFrom,
  examDateTo
}
```

Recruitment Events remain the authoritative lifecycle timeline.

Summary dates should be synchronized from Events or validated against them.

### 7.5 Current status

Suggested values:

```text
announced
application_upcoming
application_open
closing_soon
application_closed
exam_scheduled
admit_card_released
answer_key_released
result_released
final_result_released
postponed
cancelled
completed
archived
```

Status changes must be explicit and auditable.

### 7.6 Relationships

```text
Organization 1 ---- many Recruitment
Exam 1 ---- many Recruitment
Recruitment 1 ---- many RecruitmentEvent
Recruitment many ---- many Content through explicit Content links
Recruitment many ---- many SourceRecord
```

`examId` may be null only when the recruitment has no meaningful reusable Exam identity.

### 7.7 Uniqueness and indexes

Required direction:

```text
unique: tenantId + slug
index:  tenantId + organizationId + recruitmentYear
index:  tenantId + examId + recruitmentYear
index:  tenantId + currentStatus
index:  tenantId + importantDates.applicationEndDate
index:  tenantId + stateCodes
index:  tenantId + publicationStatus
```

---

## 8. Recruitment Event entity

### 8.1 Purpose

RecruitmentEvent records the chronological updates of a Recruitment.

It replaces the long-term pattern of treating every notification, admit card and result as unrelated content.

### 8.2 Event types

Initial enum direction:

```text
notification
application_open
application_close
fee_deadline
correction_open
correction_close
exam_date
exam_city
admit_card
answer_key
objection_open
objection_close
result
cutoff
document_verification
final_result
postponement
cancellation
revised_notice
other
```

### 8.3 Locked fields

Conceptual fields:

```text
tenantId
recruitmentId
eventType
sequenceNumber
title.en
title.hi
summary.en
summary.hi
eventDate
startDate
endDate
status
sourceIds[]
primarySourceId
contentId
officialActionUrl
publicationStatus
verification
createdBy
updatedBy
timestamps
```

### 8.4 Content relationship

A Recruitment Event may link to one editorial Content record through `contentId`.

Example:

```text
RecruitmentEvent:
  eventType = admit_card
  officialActionUrl = official download page
  contentId = Pravixo explanation and instructions
```

The Event stores structured facts. Content stores the readable editorial explanation.

### 8.5 Multiple events of the same type

Multiple revised notices, exam dates or results are allowed.

Therefore, uniqueness must not be based only on:

```text
tenantId + recruitmentId + eventType
```

Use a sequence or unique slug/key.

Suggested uniqueness:

```text
unique: tenantId + recruitmentId + eventType + sequenceNumber
```

### 8.6 Indexes

```text
index: tenantId + recruitmentId + eventDate
index: tenantId + eventType + eventDate
index: tenantId + publicationStatus
index: tenantId + status
```

---

## 9. SourceRecord entity

### 9.1 Purpose

SourceRecord stores the official or supporting source used to verify public facts.

It must prevent source information from being hidden only inside free-text Content.

### 9.2 Locked fields

Conceptual fields:

```text
tenantId
organizationId
sourceType
title
url
publishedAt
accessedAt
language
isOfficial
status
notes
createdBy
updatedBy
timestamps
```

Suggested `sourceType` values:

```text
official_notification
official_website
official_result
official_admit_card
official_answer_key
government_press_release
official_syllabus
official_calendar
supporting_reference
other
```

### 9.3 URL behavior

The exact source URL should be stored.

The application should later support:

- safe external links;
- broken-link checks;
- last successful verification time;
- replacement source tracking.

### 9.4 Relationships

```text
Organization 1 ---- many SourceRecord
Exam many ---- many SourceRecord
Recruitment many ---- many SourceRecord
RecruitmentEvent many ---- many SourceRecord
Content many ---- many SourceRecord
```

References should normally be stored as `sourceIds[]` on the publishable entity.

---

## 10. Verification metadata

### 10.1 Locked decision

Verification will initially be a reusable embedded subdocument on publishable entities rather than a separate Verification collection.

Conceptual structure:

```text
verification: {
  status,
  verifiedAt,
  verifiedBy,
  reviewedAt,
  reviewedBy,
  lastCheckedAt,
  notes
}
```

Suggested status values:

```text
unverified
source_checked
reviewed
verified
needs_update
disputed
```

### 10.2 Applicable entities

Verification metadata should apply to:

- Organization;
- Exam;
- Recruitment;
- RecruitmentEvent;
- Content;
- future structured current-affairs records.

### 10.3 Revision history

A full revision or correction collection is not part of the first model implementation.

However, update APIs must be designed so that a future audit-history collection can be introduced without changing entity identity.

The publishing workflow design in T-45W Step 6 will define correction and history behavior.

---

## 11. ContributorProfile entity

### 11.1 Purpose

ContributorProfile supplies real public author and reviewer identity for E-E-A-T.

It must link to an existing authenticated User rather than create a second login system.

### 11.2 Locked fields

Conceptual fields:

```text
tenantId
userId
displayName
slug
publicRole
bio.en
bio.hi
credentials[]
expertiseTaxonomyIds[]
profileImageUrl
socialLinks
isPublic
status
createdBy
updatedBy
timestamps
```

Suggested `publicRole` values:

```text
author
editor
reviewer
subject_expert
career_counsellor
organization
```

One ContributorProfile may represent multiple approved roles if the model uses an array.

### 11.3 Relationships

```text
User 1 ---- zero-or-one ContributorProfile
Content many ---- one author ContributorProfile
Content many ---- zero-or-one reviewer ContributorProfile
Exam many ---- zero-or-one reviewer ContributorProfile
Recruitment many ---- zero-or-one reviewer ContributorProfile
```

### 11.4 Security

Public profile data must be deliberately selected.

Private User fields must never be populated into public responses.

---

## 12. Content relationship design

### 12.1 Content types that remain editorial

These Content types remain valid long-term editorial types:

```text
article
study_note
current_affairs
syllabus
```

They gain structured relationships but remain Content records.

### 12.2 Legacy compatibility types

These existing types become legacy compatibility types after structured entities are introduced:

```text
exam_page
vacancy
notification
admit_card
result
```

They must not be removed immediately.

### 12.3 Exam-page migration

New evergreen Exam hubs should use the Exam entity.

Existing `exam_page` Content records may:

- link to `primaryExamId`;
- remain available at their existing URL;
- provide long-form editorial overview;
- later canonicalize or redirect according to the locked URL policy.

### 12.4 Recruitment-content migration

Existing Content types may link as follows:

```text
vacancy      -> recruitmentId
notification -> recruitmentId and optional recruitmentEventId
admit_card   -> recruitmentId and recruitmentEventId
result       -> recruitmentId and recruitmentEventId
```

Structured Recruitment and Event records become the factual source.

Legacy Content remains the editorial or compatibility page.

### 12.5 New Content relationship fields

Conceptual additive fields:

```text
primaryExamId
examIds[]
subjectId
topicId
subtopicId
recruitmentId
recruitmentEventId
sourceIds[]
authorProfileId
reviewerProfileId
relatedContentIds[]
relatedMockTestIds[]
relatedQuestionIds[]
language
translationGroupId
translatedFromId
verification
```

### 12.6 Relationship constraints

- `primaryExamId`, when present, should normally also appear in `examIds`.
- Topic must belong to Subject.
- Subtopic must belong to Topic.
- Recruitment Event must belong to Recruitment.
- All references must belong to the Content tenant.
- Published related Mock Tests must be publicly discoverable only according to test visibility and payment rules.
- Related Questions must not expose correct answers through public APIs.

### 12.7 Reverse discovery

Reverse relationships should be queried through indexed fields rather than duplicated onto every entity.

Example:

```text
Find study notes for Exam:
Content.find({ tenantId, examIds: examId, type: "study_note", status: "published" })
```

---

## 13. Question relationship design

### 13.1 Additive taxonomy fields

Question should progressively support:

```text
examIds[]
subjectId
topicId
subtopicId
sourceIds[]
language
```

Existing text-based subject, topic or exam fields must not be deleted until migration is complete.

### 13.2 Reusable questions

A Question may be useful for multiple Exams.

Therefore:

```text
examIds[]
```

is preferred over a single mandatory `examId`.

### 13.3 Taxonomy path

A Question should normally have one canonical taxonomy path:

```text
subjectId -> topicId -> subtopicId
```

A question that genuinely spans multiple topics may use controlled secondary tags later, but Phase 1 should preserve one primary analytics path.

### 13.4 PYQ metadata

PYQ relationships should later support:

```text
isPreviousYearQuestion
sourceExamId
sourceRecruitmentId
examYear
paperStage
shift
questionNumber
sourceIds[]
```

This is an approved future extension, not required in the first taxonomy commit.

### 13.5 Public safety

Public question previews must not expose:

- correct option;
- scoring keys;
- explanation when visibility rules prohibit it;
- unpublished Question Group details;
- protected test snapshots.

---

## 14. Question Group relationship design

QuestionGroup should progressively support:

```text
examIds[]
subjectId
topicId
subtopicId
sourceIds[]
language
```

The Group provides common stimulus metadata.

Individual Questions retain their own taxonomy references for analytics.

When a Group and its Questions share the same path, admin UI may offer inheritance assistance, but backend storage and validation must remain explicit.

---

## 15. Exam Pattern relationship design

The existing ExamPattern model remains the source for Mock Test structure.

Additive relationship direction:

```text
examIds[]
stageKey
```

An ExamPattern may serve multiple related Exams.

Exam links may mark one pattern as primary for a particular stage.

Safe-delete rules already implemented for referenced Exam Patterns must be extended to consider any new Exam relationship before deletion behavior changes.

---

## 16. Mock Test relationship design

### 16.1 MockTest draft

MockTest should progressively support:

```text
examId
examStageKey
subjectIds[]
taxonomyCoverage
languageCodes[]
```

A Mock Test should normally have one primary Exam.

### 16.2 Derived taxonomy coverage

Taxonomy coverage should be derived from assigned Questions at validation or publish time.

Conceptual coverage:

```text
taxonomyCoverage: [
  {
    subjectId,
    topicId,
    subtopicId,
    questionCount,
    maximumMarks
  }
]
```

Admin-entered coverage must not override actual assigned Question data.

### 16.3 MockTestVersion snapshot

At publication, the Version must snapshot:

```text
examId
examName
examSlug
examStageKey
taxonomy IDs
taxonomy display labels
language labels
question relationships
```

Snapshots must preserve historical results when live entities change.

### 16.4 Attempt analytics

Attempt analytics should progressively store both:

- stable taxonomy identifiers;
- snapshot labels.

This supports future weak-topic recommendations without breaking old results.

### 16.5 Public relations

Content may link manually to selected Mock Tests using `relatedMockTestIds`.

The platform may also generate recommendations from shared:

```text
examId
subjectId
topicId
subtopicId
```

Manual links take priority; taxonomy-based recommendations provide fallback.

---

## 17. Hybrid bilingual strategy

### 17.1 Locked decision

Canonical structured entities and long-form editorial Content use different bilingual storage strategies.

### 17.2 Canonical entities

These entities store localized labels in one record:

- Organization;
- Exam;
- TaxonomyNode;
- Recruitment;
- RecruitmentEvent;
- ContributorProfile.

Example:

```text
name.en
name.hi
description.en
description.hi
```

This preserves one identity across languages.

### 17.3 Editorial Content

Content uses one record per published language version.

Conceptual fields:

```text
language: en | hi
translationGroupId
translatedFromId
```

Reasons:

- independent draft and review workflow;
- independent author and reviewer;
- independent slug;
- independent publication date;
- language-specific body and SEO metadata;
- clear hreflang mapping;
- corrections can be applied per language.

### 17.4 Translation group

All language variants of one editorial item share:

```text
translationGroupId
```

`translatedFromId` is optional and records lineage.

### 17.5 Existing Content migration

Existing Content must not be automatically classified by character detection alone.

Migration sequence:

1. add optional language fields;
2. generate an audit of existing Content;
3. assign language explicitly;
4. backfill translation groups where pairs exist;
5. make language required only after backfill proof.

### 17.6 URL strategy

Language URL structure and hreflang policy are not locked here.

They will be decided in T-45W Step 5.

---

## 18. Publication status direction

Detailed workflow is deferred to T-45W Step 6, but new publishable entities must be compatible with:

```text
draft
in_review
published
needs_update
archived
```

Current Content `draft` and `published` behavior must remain compatible during transition.

No status expansion should be implemented without reviewing current admin forms and public filters.

---

## 19. API relationship validation rules

Every write API that accepts references must validate:

1. ObjectId format where applicable.
2. Existence.
3. Same tenant.
4. Expected entity type.
5. Active or allowed status.
6. Parent-child consistency.
7. Cross-entity consistency.

Examples:

- Topic belongs to selected Subject.
- Subtopic belongs to selected Topic.
- Recruitment belongs to selected Exam when both are supplied.
- Recruitment Event belongs to selected Recruitment.
- Source belongs to the same tenant.
- ContributorProfile belongs to the same tenant.
- Mock Test belongs to selected Exam when manually linked.
- Question relationship does not cross tenant boundaries.

Validation must happen on both create and update.

---

## 20. Deletion and archive rules

### 20.1 Default rule

Referenced structured entities should be archived or deactivated, not hard-deleted.

### 20.2 Hard delete

Hard delete may be allowed only for unused accidental records.

Before hard delete, the backend must inspect references from:

- Content;
- Question;
- QuestionGroup;
- ExamPattern;
- MockTest;
- MockTestVersion;
- Recruitment;
- RecruitmentEvent;
- SourceRecord;
- attempts or analytics where relevant.

### 20.3 Snapshot protection

Records referenced only through immutable historical snapshots may still require preservation for traceability.

Deletion design must be reviewed per entity rather than handled by one generic delete function.

---

## 21. Index direction summary

Minimum index direction:

### Organization

```text
tenantId + slug unique
tenantId + status
tenantId + organizationType
```

### Exam

```text
tenantId + slug unique
tenantId + organizationId
tenantId + examFamily
tenantId + stateCode
tenantId + status
```

### TaxonomyNode

```text
tenantId + canonicalKey unique
tenantId + kind + parentId + slug unique
tenantId + kind + status
tenantId + parentId + displayOrder
```

### Recruitment

```text
tenantId + slug unique
tenantId + organizationId + recruitmentYear
tenantId + examId + recruitmentYear
tenantId + currentStatus
tenantId + applicationEndDate
tenantId + publicationStatus
```

### RecruitmentEvent

```text
tenantId + recruitmentId + eventType + sequenceNumber unique
tenantId + recruitmentId + eventDate
tenantId + eventType + eventDate
tenantId + publicationStatus
```

### SourceRecord

```text
tenantId + url
tenantId + organizationId
tenantId + sourceType
tenantId + status
```

### ContributorProfile

```text
tenantId + slug unique
tenantId + userId unique
tenantId + status
```

### Content additions

```text
tenantId + language + slug unique after migration review
tenantId + primaryExamId + type + status
tenantId + examIds + type + status
tenantId + subjectId + topicId + status
tenantId + recruitmentId + status
tenantId + recruitmentEventId
tenantId + translationGroupId
```

Existing tenant-scoped Content slug behavior must not be changed until URL and bilingual migration policy is locked.

---

## 22. Implementation sequence

### Step 1 - Documentation only

Commit this relationship lock before code.

### Step 2 - Inspect existing schemas

Before implementation, inspect exact current fields and references in:

- Question;
- QuestionGroup;
- ExamPattern;
- MockTest;
- MockTestVersion;
- TestAttempt;
- TestAttemptDetail;
- Content;
- User;
- tenant middleware;
- admin route patterns.

### Step 3 - Implement taxonomy foundation

Implement `TaxonomyNode` first because other domains depend on it.

Required proof:

- same-tenant create and update;
- cross-tenant parent rejection;
- invalid hierarchy rejection;
- tenant-scoped uniqueness;
- safe deactivate;
- protected delete.

### Step 4 - Implement Organization

Required proof:

- tenant isolation;
- unique slug per tenant;
- public verified listing;
- safe archive;
- cross-tenant Source rejection.

### Step 5 - Implement Exam

Required proof:

- Organization tenant validation;
- Subject-link validation;
- ExamPattern-link validation;
- bilingual fields;
- tenant-scoped public queries.

### Step 6 - Add optional relationships to Content and test models

Do not make new relationships mandatory until existing data is audited and backfilled.

### Step 7 - Implement Recruitment and RecruitmentEvent

Only after Organization and Exam foundations are stable.

### Step 8 - Implement admin workflows

Public templates must not depend on fields admins cannot manage.

### Step 9 - Implement public read APIs and templates

Dedicated public pages should follow structured entities.

---

## 23. Explicit non-decisions

The following are deliberately deferred:

- exact Mongoose schema code;
- final URL hierarchy;
- `/hi` and `/en` route strategy;
- canonical and redirect rules;
- final publication workflow;
- revision-history collection;
- notifications and alert delivery;
- semantic-search engine;
- generic EntityRelation collection;
- AI publishing assistance;
- final homepage layout;
- mobile application API shape.

These decisions must be made in their assigned steps.

---

## 24. Acceptance criteria for Step 4A

Step 4A is complete when:

- this document exists in `docs`;
- all entities and relationships above are reviewed;
- legacy Content compatibility is explicitly accepted;
- hybrid bilingual strategy is accepted;
- shared TaxonomyNode strategy is accepted;
- no application code has changed;
- Markdown validation passes;
- the document is committed and pushed;
- the working tree is clean.

---

## 25. Next checkpoint

After this document is committed:

```text
T-45W Step 4B - Inspect Existing Test and Content Schemas Against the Locked Relationships
```

Step 4B is read-only.

It must map the exact existing fields in:

```text
Question
QuestionGroup
ExamPattern
MockTest
MockTestVersion
TestAttempt
TestAttemptDetail
Content
User
```

against the relationship design before any new model is created.

---

## 26. Resume checkpoint

```text
Resume PravixoEduTech from T-45W Step 4B.

Latest completed documentation:
- docs/PUBLIC_PLATFORM_ARCHITECTURE_LOCK.md
- docs/PUBLIC_PLATFORM_GAP_AUDIT.md
- docs/PUBLIC_DOMAIN_ENTITY_RELATIONSHIPS_LOCK.md

Locked relationship decisions:
- Organization and Exam are dedicated entities.
- Subject, Topic and Subtopic use one hierarchical TaxonomyNode collection.
- Recruitment and RecruitmentEvent are dedicated structured entities.
- SourceRecord stores official sources.
- verification is embedded initially.
- ContributorProfile links public author/reviewer identity to User.
- Content remains editorial.
- exam_page, vacancy, notification, admit_card and result remain legacy
  compatibility types during migration.
- canonical entities use localized fields in one record.
- editorial Content uses one record per language with translationGroupId.
- MockTestVersion snapshots Exam and taxonomy identities and labels.
- all references require same-tenant validation.

Before code:
inspect the current test-engine and Content schemas and produce a compatibility
map.
```
