# PravixoEduTech Public Platform Architecture Lock

**Status:** Locked product and architecture direction
**Phase:** T-45W — Public Platform Architecture and Gap Audit
**Baseline commit:** `bfe7d08`
**Branch:** `feature/question-group-stimulus-support`
**Actual Next.js route root:** `frontend/app`

---

## 1. Purpose

This file is the durable source of truth for the PravixoEduTech public platform. Read it before changing public routes, domain models, navigation, homepage architecture, recruitment or study features, SEO foundations, launch-readiness decisions, or the next implementation task.

Chat suggestions must not silently override this file. Major changes require documented reasoning, impact and security review, migration planning, tests, an update to this file, commit and push.

## 2. Product identity

PravixoEduTech will not be only a blog, Mock Test site, coaching-course site, vacancy portal, Sarkari Result clone, or collection of disconnected articles.

It will be a connected government-exam preparation and opportunity platform combining:

1. vacancies and recruitment updates;
2. evergreen exam hubs;
3. syllabus and exam-pattern guidance;
4. study notes and revision resources;
5. current affairs;
6. PYQs and question-bank content;
7. Mock Tests;
8. student progress and analytics;
9. paid test packages and future courses;
10. future LMS capabilities.

### Dual operating model (locked)

PravixoEduTech has two connected product responsibilities that must be preserved in every architecture, security, data, API, UI and deployment decision:

1. **PravixoEduTech Educational Platform - current launch priority.**
   PravixoEduTech directly serves its own students through public educational content, exam and recruitment information, study notes, current affairs, PYQs, question-bank content, Mock Tests, paid packages, student progress and analytics, and future course/LMS capabilities.

2. **PravixoEduTech SaaS Platform - near-term expansion.**
   The same core platform will serve independent educational institutes as isolated tenants. Each institute may have its own branding, students, content, Mock Tests, configuration and website/domain while sharing the secure PravixoEduTech technology foundation.

All implementation decisions must satisfy both responsibilities.

Launch hardening must not collapse the architecture into permanent single-tenancy. SaaS preparation must not destabilize the current PravixoEduTech educational-platform launch.

Preserve `tenantId`, tenant isolation, tenant-scoped data boundaries, role authorization and feature controls. Tenant identity must ultimately be established from trusted server-validated context such as a verified domain, subdomain, invite or other approved tenant-resolution mechanism rather than blindly trusting a client-supplied tenant identifier.

Prefer backward-compatible and additive changes that minimize future migrations. SaaS capabilities that are not securely ready for launch may remain disabled while their multi-tenant foundation is preserved.

Connected journey:

```text
Search / Social / Direct Visit
        ↓
Vacancy, exam update, note or current affair
        ↓
Exam or recruitment knowledge hub
        ↓
Eligibility, pattern, syllabus and preparation plan
        ↓
Study notes, PYQs and Mock Tests
        ↓
Student account and saved progress
        ↓
Analytics, recommendations and paid learning
```

Competitive chain:

```text
Recruitment → Exam → Syllabus → Notes → PYQs → Mock Tests → Analytics
```

## 3. Competitive benchmark

Study and preparation benchmarks:

- Drishti IAS
- Vision IAS
- Vajiram & Ravi
- PW OnlyIAS
- Adda247
- Testbook and other relevant exam platforms

Study benchmark areas:

- Hindi-first and bilingual delivery;
- daily, weekly and monthly current affairs;
- Prelims and Mains separation;
- exam-wise organization;
- revision resources;
- quizzes and Mock Test integration;
- personalization;
- content depth;
- attractive mobile UI;
- editorial trust.

Recruitment benchmarks:

- Sarkari Result
- FreeJobAlert
- Adda247 Jobs
- official recruitment and examination websites
- other high-performing job, admit-card and result portals

Recruitment benchmark areas:

- update speed;
- scanability;
- dates, vacancies, qualification, fees, age and salary;
- official links;
- application, admit-card, answer-key and result lifecycle;
- closing-soon indicators;
- expired and revised notice handling;
- mobile usability.

Useful patterns may be adopted, but branding, content and layouts must not be copied.

## 4. Audience and initial depth

The platform is Hindi-first with a clean path for English and bilingual delivery.

Initial depth priority:

1. MPPSC;
2. MPESB / Vyapam;
3. Madhya Pradesh government vacancies;
4. SSC;
5. Banking;
6. Railway;
7. UPSC;
8. other State PSC examinations;
9. other government-exam categories;
10. NEET and JEE where aligned.

Prefer deep, accurate and connected coverage over shallow mass coverage.

## 5. Existing foundation to preserve

Current public content types:

- `article`
- `study_note`
- `notification`
- `current_affairs`
- `vacancy`
- `admit_card`
- `result`
- `syllabus`
- `exam_page`

Existing route families:

- `/study-notes`
- `/notifications`
- `/current-affairs`
- `/vacancies`
- `/admit-cards`
- `/results`
- `/syllabus`
- `/exams`
- `/mock-tests`
- `/search`

Preserve and extend existing public APIs, listing/detail pages, breadcrumbs, JSON-LD, search, sitemap, robots, trust pages, and admin content/category management.

Existing or indexed URLs must not be casually renamed. Route migration requires canonicals, redirects, sitemap updates, internal-link updates and regression testing.

## 6. Core principles

### Reliability

- Verify critical information using official sources.
- Show source links, publication date and modified date.
- Show clear status: upcoming, active, closing, closed, postponed, cancelled or revised.
- Maintain correction/change history for material updates.
- Never use misleading apply or download buttons.
- Distinguish confirmed information from expected information.
- Preserve tenant isolation, authorization and safe external links.
- Support robust loading, empty and error states.
- Monitor broken official links and stale information.

### Ease of use

- Mobile-first.
- Fast search and filters.
- Clear information hierarchy.
- Easy scanning for urgent updates.
- Readable long-form study content.
- Accessible controls and typography.
- Consistent terminology.
- Strong internal linking.
- Clear next action.

### UI quality

The UI must be modern, trustworthy, professional, Hindi-friendly and educational. Avoid clutter, deceptive actions, excessive advertising, weak typography, inconsistent cards, random colors, copied layouts and thin placeholder pages.

### Versatility

The architecture must support content, recruitment, exams, taxonomy, PYQs, Mock Tests, payments, referrals, courses, future LMS, future mobile apps and multi-tenancy.

### Connected learning

Use one controlled relationship system across:

```text
Exam
Subject
Topic
Subtopic
Study Content
Current Affairs
Questions
Question Groups
PYQs
Mock Tests
Attempts
Results
Recommendations
```

## 7. Public information architecture

Primary navigation:

- Home
- Exams
- Study
- Current Affairs
- Jobs & Updates
- Mock Tests
- Courses

Jobs & Updates:

- Latest Vacancies
- Notifications
- Admit Cards
- Exam Dates
- Answer Keys
- Results
- Syllabus
- Admissions

Target route direction:

```text
/exams
/exams/[exam-slug]

/study
/study/[subject]
/study/[subject]/[topic]

/current-affairs
/current-affairs/daily
/current-affairs/weekly
/current-affairs/monthly
/current-affairs/[slug]

/jobs
/jobs/[recruitment-slug]

/notifications
/vacancies
/admit-cards
/exam-dates
/answer-keys
/results
/syllabus
/admissions

/mock-tests
/courses
/search
```

## 8. Page templates

### Exam hub

Overview, organization, latest updates, eligibility, age, stages, pattern, syllabus, dates, strategy, PYQs, notes, current affairs, free and paid tests, FAQs, official links and related exams.

### Recruitment detail

Status, closing countdown, quick facts, organization, advertisement number, vacancies, post table, dates, fees, qualification, age/relaxation, salary, selection process, pattern, syllabus, how to apply, documents, official notice/apply links, event timeline, related notes, PYQs and Mock Tests.

### Study detail

Quick summary, objectives, contents, readable body, key facts, examples, tables, diagrams, exam relevance, Prelims/Mains relevance, practice, PYQs, Mock Tests, references, author, reviewer, reviewed date and previous/next lesson.

### Current-affairs detail

What happened, why in news, event date, summary, Prelims facts, Mains perspective, background, static linkage, state relevance, key terms, official sources, possible MCQs/descriptive question, related notes and compilation links.

## 9. Domain architecture

The generic `Content` model remains useful for editorial material but must not be the only domain model.

### Exam

Tenant ownership, name/slug/short name, organization, family, scope, eligibility, age, stages, pattern, syllabus, languages, official website, status, taxonomy, related notes/current affairs/PYQs/Mock Tests, SEO, sources and review metadata.

### Organization

Tenant ownership, name/slug/short name, type, jurisdiction/state, website, logo, verification, related exams/recruitments and SEO metadata.

### Recruitment

Tenant ownership, organization, title/slug, advertisement number, related Exam, year/cycle, posts, vacancy table, qualifications, age/relaxation, salary, fees, mode, dates, process, official notice/apply links, location, status, publication, verification and SEO metadata.

### Recruitment Event

Notification, application opening/closing, correction, exam date/city, admit card, answer key, objection, result, cut-off, document verification, final result, cancellation, postponement and revised notice—all linked to one Recruitment.

### Study taxonomy

Exam, subject, topic, subtopic, language, difficulty, format, Prelims/Mains relevance, PYQs, questions, Mock Tests, sources, author, reviewer and reviewed date.

### Current-affairs metadata

Event/publication dates, subject/topic, exam relevance, Prelims/Mains relevance, state relevance, official sources, facts, background, static linkage, possible questions and compilation relationships.

## 10. Shared taxonomy

The same controlled taxonomy must serve content, current affairs, questions, groups, PYQs, Mock Tests, exam pages, recommendations and analytics.

Different language labels may exist, but the underlying identity must remain connected. Avoid fragmented records for equivalent labels such as `Indian Polity`, `Polity`, `POLITY` and `भारतीय राजव्यवस्था`.

## 11. Recruitment lifecycle

Long-term structure:

```text
Recruitment
    ├── Notification
    ├── Application
    ├── Correction
    ├── Exam Date
    ├── Admit Card
    ├── Answer Key
    ├── Result
    ├── Cut-off
    └── Final Result
```

Legacy Content records may remain during migration.

## 12. Advanced student features

Roadmap:

- My Exams;
- follow exam/organization;
- deadline, admit-card and result alerts;
- bookmarks and saved notes;
- reading history and continue preparation;
- personalized homepage;
- recommended notes;
- weak-topic recommendations;
- related Mock Tests;
- change history;
- bilingual paired content;
- monthly compilations;
- downloads;
- semantic search;
- future PWA and mobile app.

Phase these without destabilizing MVP.

## 13. Unified search

Eventually search exams, organizations, recruitments/events, notes, current affairs, syllabus, Mock Tests, public PYQs and courses.

Progressive support: spelling tolerance, Hindi/English, aliases, exam/organization/state/qualification/type/date/status filters, semantic relevance, popular and recent suggestions.

## 14. SEO lock

Requirements:

- crawlable server-rendered pages;
- canonicals;
- unique titles/descriptions;
- semantic headings;
- breadcrumbs and internal links;
- optimized images and alt text;
- clean URLs;
- correct status codes and redirects;
- duplicate control and pagination handling;
- Core Web Vitals;
- segmented XML sitemaps;
- robots control;
- expired recruitment and archive policy;
- accurate structured data;
- original useful content;
- topic clusters;
- no thin mass-generated pages.

Sitemap direction:

```text
/sitemap-exams.xml
/sitemap-study.xml
/sitemap-current-affairs.xml
/sitemap-jobs.xml
/sitemap-mock-tests.xml
/news-sitemap.xml
```

Implementation must follow current search-engine requirements.

## 15. AEO lock

Build answer-friendly visible structure: direct answers, summaries, key facts, date tables, eligibility summaries, steps, comparison tables, definitions, useful FAQs and natural question headings. No keyword stuffing or hidden answers.

## 16. GEO and LLMO lock

Use explicit entities and relationships, factual statements, sources, dates, status labels, consistent terminology, structured summaries, useful tables, internal links, author/reviewer identity, original context, and separation of fact, analysis and advice. No hidden AI-only content.

## 17. AISEO lock

AI may assist authorized admins with titles, meta descriptions, summaries, FAQs, tags, links, schema recommendations, duplicate/staleness alerts, source comparison, translation and readability.

No AI-assisted content may auto-publish without human editorial review. Preserve accuracy, traceability, originality, tenant isolation, permissions and auditability.

## 18. E-E-A-T lock

Important pages should expose author, reviewer, expertise, editorial/correction policies, organization, dates, sources, official links, feedback/correction channel and change history. Trust signals must be real.

## 19. Structured data

Structured data must match visible content. Potential types: `Organization`, `WebSite`, `BreadcrumbList`, `Article`, `NewsArticle`, eligible `FAQPage`, individual-page `JobPosting`, `Course`, and other currently supported types after verification.

Do not place `JobPosting` on generic lists. Handle closed/expired jobs accurately.

## 20. Editorial and sources

Record source organization, source title, official URL, source date, verification date, verified by, material changes and corrections.

Clearly distinguish official fact, Pravixo explanation, preparation advice and expected information. Expected dates must never appear as confirmed.

## 21. UI direction

Public UI: mobile-first, fast, attractive, professional, reliable, Hindi-friendly, accessible, scannable and consistent.

Learning pages prioritize reading width, typography, contents, progress, diagrams, practice and contextual navigation.

Recruitment pages prioritize compact summaries, status badges, dates, vacancy tables, official actions and timeline.

Do not force every domain into one generic article template.

## 22. Admin workflow

Future modules: Exams, Organizations, Subjects, Topics, Study Content, Current Affairs, Recruitments, Recruitment Events, Official Sources, Review/Verification, Publishing, Corrections, Internal Linking, SEO Preview, Structured Data Preview, Related Questions and Related Mock Tests.

Preserve roles, tenant isolation, drafts, validation, audit history, archive behavior and protected deletion.

## 23. Multi-tenant requirements

Every new model/API requires `tenantId`, tenant filters, tenant-scoped uniqueness, relationship validation, safe super-admin behavior, protected routes, object-level filtering and safe population.

Never accept a referenced ObjectId from an admin request without validating tenant access.

## 24. Development discipline

Workflow:

1. inspect;
2. understand impact;
3. design;
4. lock decisions;
5. implement minimally;
6. syntax test;
7. API/unit proof;
8. browser proof where applicable;
9. clean disposable records;
10. inspect diff;
11. commit;
12. push;
13. record next checkpoint.

Protect completed modules, avoid broad replacements and speculative schema changes, do not commit failed experiments, keep the tree clean, avoid thin placeholder pages, test tenant isolation for every new domain, and update this lock when decisions change.

## 25. Implementation order

### Phase A — Reality and gap audit

1. inventory public routes/components;
2. inventory backend models/APIs;
3. inspect structured data, sitemap and robots;
4. run build/runtime baseline;
5. produce feature-gap matrix.

### Phase B — Detailed architecture

1. lock entities and relationships;
2. lock taxonomy;
3. lock routes and URL migration;
4. lock admin workflows;
5. lock publishing and verification lifecycle.

### Phase C — Backend foundation

Taxonomy, Organization, Exam, Recruitment, Recruitment Event, source/verification metadata, protected APIs and tenant-isolation proofs.

### Phase D — Admin workflows

Organization/taxonomy, exams, recruitments, timeline, structured study/current affairs, sources and publishing controls.

### Phase E — Public experience

Navigation, homepage, exam/study/current-affairs/recruitment hubs, detail templates, search/filters, related content and Mock Test connections.

### Phase F — Personalization

My Exams, bookmarks, alerts, history, preparation progress and weak-topic recommendations.

### Phase G — Search visibility and launch

SEO, AEO, GEO, LLMO, AISEO, E-E-A-T, accessibility, performance, security and launch audit.

## 26. Current checkpoint

Completed:

- T-45V Admin Panel tenant-isolation audit;
- Content–Category tenant validation;
- tenant-scoped Content slug uniqueness;
- live MongoDB index migration;
- final tenant-isolation closure.

Baseline commit:

```text
bfe7d08 Scope content slug uniqueness by tenant
```

Current phase:

```text
T-45W — Public Platform Architecture and Gap Audit
```

Next after committing this file:

```text
T-45W Step 3 — Existing Public Platform Reality and Feature-Gap Audit
```

Inspect `frontend/app`, public components, backend models/APIs, navigation, search, sitemap, structured data and production build before major coding.

## 27. New-chat resume checkpoint

```text
Resume PravixoEduTech from T-45W — Public Platform Architecture and Gap Audit.

Baseline before architecture lock:
bfe7d08 Scope content slug uniqueness by tenant

Branch:
feature/question-group-stimulus-support

Actual Next.js route root:
frontend/app

Read:
docs/PUBLIC_PLATFORM_ARCHITECTURE_LOCK.md

Direction:
Connect recruitment updates, exam hubs, study notes, current affairs, PYQs,
Mock Tests and student analytics.

Benchmarks:
Drishti IAS, Vision IAS, Vajiram & Ravi, PW OnlyIAS, Adda247, Testbook,
Sarkari Result and other relevant platforms—without copying.

Non-negotiable:
reliability, attractive mobile-first UI, ease of use, bilingual capability,
tenant safety, SEO, AEO, GEO, LLMO, AISEO and E-E-A-T.

Next:
complete reality inventory and feature-gap matrix, then lock detailed models,
relationships, routes and admin workflows.
```

## 28. Change control

Major changes require documented reason, impact/security review, migration plan, update to this file, passing tests, commit and push.
