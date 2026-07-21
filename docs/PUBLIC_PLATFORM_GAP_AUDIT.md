# PravixoEduTech Public Platform Gap Audit

**Status:** Evidence-based current-state audit
**Phase:** T-45W - Public Platform Architecture and Gap Audit
**Architecture lock commit:** `3f9ff16`
**Branch:** `feature/question-group-stimulus-support`
**Actual Next.js route root:** `frontend/app`

---

## 1. Purpose

This document records the verified gap between the current PravixoEduTech public platform and the target architecture locked in:

```text
docs/PUBLIC_PLATFORM_ARCHITECTURE_LOCK.md
```

It is based on:

- the existing public route inventory;
- focused frontend source inspection;
- focused backend Content and Category inspection;
- the successful Next.js production build;
- the locked public-platform product direction.

This audit must be used before creating new public models, APIs, admin workflows, route families, page templates, search features or homepage redesigns.

---

## 2. Executive conclusion

The current public platform is a strong technical foundation, but it is not yet a feature-complete public product.

Verified status:

```text
Production build:                    Passed
TypeScript:                          Passed
Existing public route foundation:    Strong
Existing generic Content system:     Working
Tenant-scoped Content foundation:    Working
Basic metadata and JSON-LD:          Present
Feature-complete exam platform:      No
Feature-complete recruitment portal: No
Connected study-to-test platform:    No
Production launch readiness:         No
Suitable for structured expansion:  Yes
```

The correct strategy is to preserve the current foundation while adding structured domain architecture and dedicated workflows.

A homepage-only redesign would improve appearance but would not solve the critical product gaps.

---

## 3. Verified strengths to preserve

### 3.1 Stable public route foundation

Public routes already exist for:

- homepage;
- About;
- Contact;
- Editorial Policy;
- Correction Policy;
- Articles;
- Study Notes;
- Current Affairs;
- Exams;
- Notifications;
- Vacancies;
- Admit Cards;
- Results;
- Syllabus;
- Mock Tests;
- Search.

Listing and detail route families already exist for the generic Content types.

### 3.2 Successful production build

The Next.js production build passed:

- compilation;
- TypeScript;
- page data collection;
- generation of 28 static pages;
- recognition of dynamic listing and detail routes;
- final optimization.

The build left the Git working tree clean.

### 3.3 Published-only public access

The public Content controller limits public records to:

- the configured public tenant;
- `status: "published"`;
- allowed Content types.

Draft Content is not returned through public Content endpoints.

### 3.4 Tenant-scoped Content and Category foundation

Current Content and Category records include `tenantId`.

Current uniqueness is tenant-scoped for:

- Content slug;
- Category slug.

Content create and update validate that the selected Category belongs to the same tenant.

### 3.5 Basic SEO foundation

The frontend already includes:

- root metadata;
- page metadata;
- dynamic detail metadata;
- Open Graph foundation;
- robots configuration;
- XML sitemap generation;
- publication and modification dates;
- JSON-LD;
- WebPage schema;
- Article or NewsArticle schema;
- BreadcrumbList schema;
- visible breadcrumbs;
- Quick Answer blocks;
- visible updated date;
- tags;
- Editorial Policy;
- Correction Policy.

### 3.6 Reusable public components

The current public area has reusable components for:

- navigation;
- footer;
- search bar;
- generic Content listing;
- generic Content detail;
- static trust pages.

This is a useful foundation and should not be discarded.

### 3.7 Strong Mock Test engine exists

The protected student platform already includes:

- secure test attempts;
- save and resume;
- server-side scoring;
- results;
- review;
- section summaries;
- topic summaries;
- difficulty summaries;
- attempt history.

This is a major competitive asset. The public platform must connect to it rather than rebuild it.

---

## 4. Immediate scale defects

These are current implementation limitations that will become visible defects as published content grows.

### 4.1 Sitemap is limited to 100 Content detail URLs

The sitemap requests:

```text
limit=500
```

However, the public Content API applies:

```text
Math.min(requestedLimit, 100)
```

Therefore, only the newest 100 published Content records can be included through the current sitemap fetch, even though the sitemap requests 500.

**Impact:**

- older Content detail pages can be omitted from the sitemap;
- crawl discovery weakens after 100 published records;
- search-engine coverage becomes incomplete;
- the problem grows silently as content volume increases.

**Required future fix:**

Introduce proper pagination or a dedicated sitemap-safe endpoint. Do not merely raise the limit without considering scale and query cost.

### 4.2 Public search is also limited to the newest 100 records

The search helper requests up to 120 records, but the backend caps the request at 100.

Search then performs in-memory substring matching only on those returned records.

**Impact:**

- older records become unsearchable;
- search completeness decreases as content volume grows;
- no true server-side search exists;
- no pagination exists;
- search results depend on the newest Content subset.

**Required future fix:**

Move search filtering to a dedicated server-side search endpoint with pagination and controlled filters.

### 4.3 Listing pages expose only the newest 24 records

The generic list helper defaults to 24 records.

There is no verified pagination, archive navigation, load-more workflow or page-number routing.

**Impact:**

- older records become difficult to discover;
- internal crawl paths weaken;
- users cannot browse complete archives;
- category depth becomes hidden.

**Required future fix:**

Add server-supported pagination or cursor-based archives before large-scale publishing.

---

## 5. Critical architecture gaps

### 5.1 No structured Exam entity

Current exam pages are generic Content records with:

```text
type = exam_page
```

There is no dedicated Exam model or API for:

- official exam name;
- short name;
- conducting organization;
- exam family;
- state or national scope;
- eligibility;
- age rules;
- stages;
- languages;
- official site;
- pattern relationship;
- syllabus relationship;
- related subjects;
- related notes;
- related current affairs;
- related PYQs;
- related Mock Tests.

**Severity:** Critical

### 5.2 No Organization entity

Organizations are not modeled as reusable verified entities.

There is no structured foundation for:

- conducting bodies;
- recruiting bodies;
- official websites;
- organization aliases;
- jurisdiction;
- state;
- verification;
- related exams;
- related recruitments.

**Severity:** Critical

### 5.3 No Recruitment entity

Vacancies are generic Content records.

There is no structured Recruitment model for:

- advertisement number;
- organization;
- recruitment cycle;
- post list;
- vacancy breakdown;
- qualification;
- age rules;
- relaxations;
- salary;
- fees;
- dates;
- selection process;
- application mode;
- official notification;
- official apply link;
- status.

**Severity:** Critical

### 5.4 No Recruitment Event lifecycle

Notifications, admit cards and results currently exist as separate generic Content types.

There is no shared timeline connecting:

```text
Recruitment
    -> Notification
    -> Application
    -> Correction
    -> Exam Date
    -> Admit Card
    -> Answer Key
    -> Result
    -> Cut-off
    -> Document Verification
    -> Final Result
```

**Severity:** Critical

### 5.5 No shared Exam-Subject-Topic taxonomy

Current Category is flat and contains only:

- name;
- slug;
- description;
- icon;
- active status.

There is no verified controlled structure for:

```text
Exam
Subject
Topic
Subtopic
```

There is no shared identity connecting public Content with:

- Question;
- Question Group;
- Mock Test;
- attempt analytics;
- recommendations.

**Severity:** Critical

### 5.6 No structured source and verification model

The Content model contains no dedicated fields for:

- official source URL;
- source organization;
- source title;
- source publication date;
- verification date;
- verified by;
- reviewer;
- last-reviewed date;
- material change summary;
- correction history.

The visible detail template uses hardcoded trust text rather than data-driven editorial records.

**Severity:** High

### 5.7 No author or reviewer entities

The detail page displays:

```text
PravixoEduTech Editorial Team
```

This is hardcoded and not connected to a verifiable author or reviewer record.

There is no structured author expertise or reviewer workflow.

**Severity:** High

### 5.8 No bilingual public-domain architecture

The root document language and structured data currently use English India.

The Content model has no verified paired Hindi and English fields or translation relationship.

There is no controlled architecture for:

- Hindi title;
- English title;
- Hindi body;
- English body;
- bilingual slug strategy;
- translated taxonomy labels;
- hreflang;
- paired translated pages.

**Severity:** High

---

## 6. Public page-template gaps

### 6.1 One generic list template serves all Content types

Articles, exams, current affairs, notifications, vacancies, admit cards, results, syllabus and notes all use the same list-card structure.

The generic card includes:

- category;
- date;
- title;
- summary;
- tags;
- detail link.

This is useful for the initial foundation but insufficient for domain-specific discovery.

Examples:

- vacancy cards need status, closing date, vacancy count and organization;
- result cards need result stage, exam and publication date;
- admit-card cards need exam date and download status;
- current-affairs cards need event date and exam relevance;
- study notes need subject, topic, difficulty and revision format.

### 6.2 One generic detail template serves all Content types

The same detail template is used for all public Content types.

The body is rendered as plain paragraphs split by blank lines.

It does not provide structured support for:

- headings;
- table of contents;
- lists;
- tables;
- rich links;
- callouts;
- diagrams;
- embedded media;
- official action buttons;
- vacancy tables;
- timelines;
- comparison tables;
- FAQs;
- practice questions;
- related Mock Tests;
- previous and next learning navigation.

**Severity:** High

### 6.3 Recruitment details are not scan-optimized

The generic detail template cannot yet present:

- important-date table;
- vacancy table;
- qualification table;
- age and relaxation table;
- fee table;
- salary;
- application steps;
- official notification action;
- official apply action;
- lifecycle timeline;
- closing status.

**Severity:** Critical for recruitment competitiveness

### 6.4 Study pages are not learning-optimized

The current template lacks:

- learning objectives;
- table of contents;
- reading progress;
- headings and sections;
- key-fact callouts;
- examples;
- diagrams;
- practice questions;
- related PYQs;
- related Mock Tests;
- previous and next topic navigation.

**Severity:** High

### 6.5 Current affairs are not exam-analysis optimized

The current model and template lack structured sections for:

- what happened;
- why it is in the news;
- event date;
- Prelims facts;
- Mains perspective;
- background;
- static linkage;
- state relevance;
- official sources;
- possible MCQs;
- possible descriptive questions;
- daily, weekly and monthly compilation relationships.

**Severity:** High

---

## 7. Search and discovery gaps

Current search:

- retrieves a bounded public Content list;
- creates a local searchable string;
- lowercases it;
- requires every search word to appear as a substring;
- returns at most 30 matched records.

Missing capabilities:

- server-side search;
- pagination;
- relevance ranking;
- typo tolerance;
- aliases;
- abbreviations;
- Hindi-English equivalence;
- exam filter;
- organization filter;
- state filter;
- qualification filter;
- content-type filter;
- date filter;
- status filter;
- subject and topic filter;
- Recruitment Event search;
- Mock Test integration;
- semantic search.

**Severity:** High

---

## 8. SEO, AEO, GEO and LLMO gaps

### 8.1 Canonical implementation was not found in the inspected public source

Metadata exists, but the audit did not find a canonical implementation in the inspected files.

This must be verified and added deliberately before URL migrations or duplicate route variants are introduced.

### 8.2 Sitemap is a single generic sitemap

The current sitemap combines static routes and generic Content detail routes.

The locked target requires scalable segmentation such as:

- exams;
- study;
- current affairs;
- jobs;
- Mock Tests;
- news sitemap where appropriate.

### 8.3 Structured data is generic

Current detail JSON-LD uses:

- WebPage;
- BreadcrumbList;
- Article;
- NewsArticle.

Vacancy, admit-card and result pages fall back to generic WebPage behavior.

Missing domain-specific structured data includes:

- Organization;
- WebSite search action where appropriate;
- valid JobPosting for eligible recruitment details;
- Course;
- FAQPage only where eligible and visibly supported;
- richer entity relationships.

### 8.4 Language is hardcoded

Structured data uses:

```text
en-IN
```

The root document also uses English India.

This does not yet support the locked Hindi-first bilingual target.

### 8.5 Trust information is hardcoded

Hardcoded editorial labels are not enough for strong E-E-A-T or GEO.

Trust must become data-driven through:

- real author;
- real reviewer;
- source records;
- verification timestamps;
- correction records;
- expertise;
- change history.

### 8.6 Quick Answer exists but deeper AEO structure is missing

The current Quick Answer block is a good foundation.

Missing answer-oriented structures include:

- important dates;
- eligibility summary;
- key facts;
- step-by-step process;
- comparison tables;
- visible FAQs;
- concise definitions;
- status summaries.

---

## 9. Navigation and homepage gaps

Current primary navigation includes:

- Home;
- Exams;
- Current Affairs;
- Notes;
- Jobs;
- Mock Tests.

This is a useful early foundation.

Missing locked information architecture:

- Study hub;
- Jobs & Updates hub;
- Courses;
- nested update categories;
- answer keys;
- exam dates;
- admissions;
- organization hubs;
- subject and topic hubs;
- personalized entry points.

The homepage currently uses static exam category labels that all link to `/exams`.

It does not yet surface:

- real exam cards;
- real latest updates;
- closing-soon recruitments;
- active application deadlines;
- latest current affairs;
- recommended study paths;
- free Mock Tests;
- personalized content;
- trust and source signals.

Homepage redesign should occur only after the structured data and APIs can populate it correctly.

---

## 10. Mock Test connection gap

The Mock Test engine is currently presented as a protected area reached through login.

The public ecosystem does not yet have structured relationships for:

```text
Exam -> Subject -> Topic -> Note -> PYQ -> Mock Test
```

Missing public connections:

- related Mock Tests on exam pages;
- related tests on study notes;
- related questions on current affairs;
- PYQ collections;
- free test previews;
- test syllabus coverage;
- weak-topic follow-up content;
- preparation progress.

**Severity:** Critical competitive opportunity

---

## 11. Admin workflow gaps

Current admin workflows support generic:

- Content list;
- Content create;
- Content edit;
- Category management.

Missing dedicated workflows:

- Organization management;
- Exam management;
- Subject management;
- Topic management;
- Recruitment management;
- Recruitment Event timeline management;
- official source management;
- author and reviewer management;
- verification workflow;
- correction and change history;
- structured current-affairs fields;
- relationship management;
- related Mock Test assignment;
- SEO preview;
- structured-data preview;
- bilingual pairing.

**Severity:** Critical

Public templates must not be built before admins can populate their required structured fields.

---

## 12. Backend API gaps

The current public Content API supports:

- published Content list;
- optional type filter;
- optional tag filter;
- bounded limit;
- Content detail by slug.

Missing API foundations:

- pagination;
- total record count for archives;
- category filter;
- exam filter;
- organization filter;
- state filter;
- status filter;
- date filter;
- qualification filter;
- subject and topic filters;
- server-side search;
- dedicated sitemap pagination;
- dedicated Exam APIs;
- dedicated Recruitment APIs;
- Recruitment Event APIs;
- taxonomy APIs;
- source and verification APIs.

### Legacy duplicate public endpoints

The Content routes expose both:

```text
/api/content/public
/api/content/public/:slug
```

and legacy aliases:

```text
/api/content
/api/content/:slug
```

The aliases currently point to the same public behavior.

They should not be removed casually, but their long-term compatibility and deprecation policy should be documented.

---

## 13. Environment and deployment gaps

Current frontend files use environment variables with localhost fallbacks.

This is acceptable for local development, but production must guarantee:

- required public site URL;
- required public API URL;
- correct metadata base;
- correct sitemap host;
- correct robots host;
- no production canonical or sitemap URL using localhost;
- environment validation;
- centralized configuration;
- deployment documentation.

---

## 14. Feature-gap priority matrix

| Area | Current state | Target state | Severity |
|---|---|---|---|
| Production build | Passing | Passing continuously | Complete baseline |
| Public routes | Generic route families | Connected domain hubs | Medium |
| Content CRUD | Working generic CRUD | Structured editorial workflows | Medium-High |
| Exam | Generic `exam_page` | Dedicated Exam entity | Critical |
| Organization | Missing | Verified reusable entity | Critical |
| Recruitment | Generic vacancy Content | Dedicated Recruitment entity | Critical |
| Recruitment lifecycle | Disconnected update types | Recruitment Event timeline | Critical |
| Shared taxonomy | Flat Category/tags | Exam-Subject-Topic-Subtopic | Critical |
| Study-test linkage | Missing | Connected learning graph | Critical |
| Sitemap scale | Capped at 100 details | Complete paginated sitemaps | High |
| Search scale | Newest 100 only | Server-side paginated search | High |
| Listing archives | First 24 only | Complete browseable archives | High |
| Page templates | One generic template | Domain-specific templates | High |
| Rich study content | Plain paragraphs | Structured rich learning content | High |
| Sources | Unstructured | Official source records | High |
| Author/reviewer | Hardcoded labels | Verifiable profiles and workflow | High |
| Bilingual | English hardcoded | Hindi-English paired architecture | High |
| Current affairs | Generic article | Exam-analysis structure | High |
| SEO | Good foundation | Segmented scalable SEO | High |
| AEO | Quick Answer foundation | Structured answer modules | Medium-High |
| GEO/LLMO | Generic entity signals | Explicit sourced relationships | High |
| AISEO | Missing | Human-reviewed admin assistance | Future-High |
| Personalization | Test history only | My Exams, alerts, bookmarks | Future-High |
| Environment | Local fallbacks | Validated production config | Medium |

---

## 15. Locked implementation order after this audit

### T-45W Step 4 - Detailed domain and relationship design

Before application code:

1. define Organization;
2. define Exam;
3. define Subject;
4. define Topic and Subtopic;
5. define Recruitment;
6. define Recruitment Event;
7. define Source and verification metadata;
8. define author and reviewer strategy;
9. define Content relationships;
10. define Question and Mock Test relationships;
11. define bilingual strategy;
12. define migration compatibility with existing Content records.

### T-45W Step 5 - URL and migration policy

Lock:

- routes that remain;
- new routes;
- legacy aliases;
- canonical strategy;
- redirect strategy;
- sitemap strategy;
- archive and expired-page strategy.

### T-45W Step 6 - Admin publishing workflow design

Lock the workflow for:

- draft;
- source verification;
- review;
- publish;
- update;
- correction;
- archive;
- deactivate;
- safe delete.

### Backend implementation order

1. shared taxonomy foundation;
2. Organization model and protected APIs;
3. Exam model and protected APIs;
4. Recruitment model;
5. Recruitment Event model;
6. source and verification metadata;
7. tenant-isolation proofs;
8. admin workflows;
9. public read APIs;
10. public templates.

### Public implementation order

1. public shell and navigation;
2. Exam hubs;
3. Recruitment hub and details;
4. Study hub;
5. Current Affairs hub;
6. search and archives;
7. Mock Test connections;
8. homepage populated from real data;
9. personalization;
10. final SEO/AEO/GEO/LLMO/E-E-A-T audit.

---

## 16. Items not to implement yet

Do not begin with:

- a homepage-only redesign;
- mass creation of placeholder routes;
- visual cloning of competitors;
- large-scale Content publishing before archive pagination;
- a production launch;
- AI auto-publishing;
- semantic search before controlled taxonomy;
- personalization before Exam and taxonomy relationships;
- removal of existing indexed routes;
- overloading the current Content model with every recruitment field.

---

## 17. Immediate next task

The next task is:

```text
T-45W Step 4A - Lock Public Domain Entity Relationships
```

This step should produce a design document before schema code.

It must define:

```text
Organization
Exam
Subject
Topic
Subtopic
Recruitment
RecruitmentEvent
Source/Verification
Content relationships
Question relationships
MockTest relationships
Bilingual relationships
```

It must also define which current Content types remain editorial and which become legacy compatibility types after structured entities are introduced.

---

## 18. Current checkpoint

```text
Completed:
- T-45V Admin Panel Tenant-Isolation Audit
- T-45W Public Platform Architecture Lock
- T-45W Step 3A Public Reality Inventory
- T-45W Step 3B Production Build Baseline
- T-45W Step 3C Focused Source Inspection

Latest committed checkpoint:
3f9ff16 Lock public platform architecture

Branch:
feature/question-group-stimulus-support

Working tree after inspection and build:
Clean

Next:
T-45W Step 4A - Lock Public Domain Entity Relationships
```
