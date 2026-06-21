# PravixoEduTech Mock Test Engine Lock

Last Updated: 2026-06-21  
Branch: feature/question-group-stimulus-support

---

## Purpose

This document locks the final architecture, scope, current status, and pending roadmap for the PravixoEduTech Mock Test Engine before frontend integration begins.

This document prevents architecture switching midway.

Development rule:

Design -> Review -> Code -> Test -> Commit -> Push

---

## Core Product Requirements

PravixoEduTech core requirements are:

1. Mock tests
2. Previous-year papers / PYQ
3. Multilingual tests
4. Sectional tests
5. Topic-wise tests
6. All-exam support
7. Rich questions with images, instructions, tables, passages, and mathematical content
8. JEE / NEET support
9. Multi-correct answer support
10. Match-the-column support
11. Detailed performance analysis after tests
12. CPCT typing test
13. Study notes
14. Government job alerts
15. E-books / PDFs

---

## Final Locked Mock Test Engine Decisions

### 1. Universal Exam Pattern Engine

Every test must follow an ExamPattern.

ExamPattern controls sections, duration, marks, negative marks, navigation, section switching, language switching, and exam type.

Status: Implemented for MCQ foundation.

Pending:

- Advanced exam-specific restrictions
- JEE / NEET partial marking
- CPCT mixed-test enforcement

---

### 2. MockTest Draft + MockTestVersion Frozen Snapshot

MockTest is editable.

MockTestVersion is a frozen published snapshot.

Student attempts must always use MockTestVersion, not live editable questions.

Status: Implemented.

Completed:

- MockTest model
- MockTestVersion model
- Publish snapshot
- Republish/versioning
- Student attempts use active version
- Result/review use frozen snapshot

---

### 3. Reusable Question Bank + Locked PYQ Snapshot

Mock tests can use reusable questions.

PYQ tests must behave like locked previous-year papers.

PYQ rules:

- Preserve original paper structure
- Preserve original question order
- Preserve original option order by default
- No random shuffle by default
- Store exact year/exam/shift metadata

Status: Partially implemented.

Completed:

- Question bank foundation
- Snapshot architecture
- sourceType foundation
- shuffleQuestions / shuffleOptions settings

Pending:

- Dedicated PYQ metadata
- PYQ import workflow
- PYQ admin filters
- PYQ frontend pages
- PYQ exact-paper enforcement mode

---

### 4. Universal QuestionGroup / Stimulus Layer

QuestionGroup is a universal common-instruction/stimulus layer.

It is not limited to reading comprehension.

It supports:

- Common instructions
- Passages
- Seating arrangement
- Puzzle sets
- Data interpretation
- Tables
- Images
- Statement-based UPSC questions
- Caselets
- Match sets
- Grouped reasoning questions

Status: Backend foundation implemented.

Completed:

- QuestionGroup model
- groupType
- instructionEn / instructionHi
- passageEn / passageHi
- contentBlocks
- displayMode
- grouped question linking
- groupQuestionOrder
- snapshot into MockTestVersion

Pending:

- Admin rich group editor
- Frontend content renderer
- Image upload workflow
- Table renderer
- Math renderer

---

### 5. Secure Student Attempt Lifecycle

Student APIs must never expose correct answers, correct options, solutions, or explanations before allowed visibility.

Score must be calculated by backend from MockTestVersion snapshot.

Frontend must never control score.

Status: Implemented and heavily tested for MCQ.

Completed:

- Start attempt
- Resume attempt
- Save/update answer
- Submit attempt
- Backend score calculation
- Result API
- Review API
- Review visibility
- Attempt expiry handling
- Max attempt handling
- Attempt history
- Dashboard action summary
- No answer/solution leak in student test payload

Pending:

- Extend same lifecycle to multi-correct
- Extend same lifecycle to numerical
- Extend same lifecycle to match-the-column
- Extend same lifecycle to typing tests

---

## Current Completion Status

| Requirement | Current Status |
|---|---|
| Mock tests | Backend strong MVP complete; frontend pending |
| Previous-year papers / PYQ | Architecture partially ready; dedicated PYQ workflow pending |
| Multilingual tests | Hindi/English fields ready; frontend toggle pending |
| Sectional tests | Backend ready; frontend pending |
| Topic-wise tests | Metadata and summaries ready; topic-wise builder pending |
| All-exam support | Architecture ready; advanced types pending |
| Images/instructions | Backend foundation ready; renderer pending |
| Mathematical content | Latex field exists; math renderer pending |
| JEE / NEET | Not fully ready; needs numerical, multi-correct, match, math renderer |
| Multi-correct answers | Pending implementation |
| Match-the-column | Pending implementation |
| Detailed performance analysis | Basic/medium analytics ready; advanced analytics pending |
| CPCT typing | Locked for later; pending |
| Study notes | Content backend foundation ready; frontend pending |
| Government job alerts | Content backend foundation ready; specific alert workflow pending |
| E-books / PDFs | Upload/download/access-control workflow pending |

---

## Completed Backend Modules Relevant to Mock Test Engine

Completed:

- Multi-tenant SaaS foundation
- Tenant isolation
- Role-based access
- Feature flags
- Exam pattern management
- Category management
- Content management foundation
- MockTest builder backend
- MockTestVersion publishing
- QuestionGroup stimulus backend
- Student mock test listing
- Student attempt start/resume
- Student answer save/update
- Student submit
- Student result
- Student review
- Student attempt history
- Student dashboard action summary

Latest important commits:

- 5cb67ce: Add student mock test attempt history API
- 6420072: Fix student mock test listing and submit response metadata
- 066e1a8: Add student mock test dashboard action summary

---

## Detailed Analytics Status

Already available:

- totalQuestions
- attempted
- correct
- wrong
- skipped
- score
- maxScore
- percentage
- accuracy
- negative marks
- section summaries
- topic summaries
- difficulty summaries
- attempt history
- review metadata

Pending:

- Rank / leaderboard
- Average score comparison
- Topper comparison
- Weak-topic report
- Mistake notebook
- Time management report
- Suggested practice plan
- Test-wise progress graph
- Retry wrong questions

---

## Advanced Question Types Roadmap

### Multi-correct

Pending:

- questionType: mcqMulti
- correct option array
- student selected option array
- validation
- full scoring
- partial scoring
- negative marking rule
- frontend checkbox UI
- review display

---

### Numerical Answer

Pending:

- questionType: numerical
- numeric correct answer
- tolerance range
- student numeric input
- validation
- scoring
- frontend numeric input UI

---

### Match-the-column

Pending:

- questionType: matchColumn
- left column schema
- right column schema
- correct pair mapping
- student pair response
- scoring
- frontend dropdown matching UI
- review display

MVP recommendation:

Use dropdown matching first, not drag-and-drop.

---

### CPCT Typing

Pending:

- typing section type
- typing passage model
- typing attempt detail
- WPM calculation
- accuracy calculation
- error count
- English typing
- Hindi typing
- CPCT mixed test

Locked CPCT structure:

1. MCQ section
2. English typing section
3. Hindi typing section

---

## Content Module Status

Core content requirements:

- Study notes
- Government job alerts
- E-books / PDFs
- Current affairs
- SEO articles
- Notifications

Completed foundation:

- Content model
- Category model
- SEO fields
- Public GET access
- Admin-protected create/update/delete
- Tenant-aware content

Pending:

- Public frontend pages
- Sarkari Result-style listing
- Study note page
- Government job alert page
- E-book/PDF upload
- PDF access control
- Search/filter
- SEO slug pages

---

## Frontend Roadmap

Frontend must be built in this order:

1. Student Mock Test Listing
2. Start/Resume Test
3. MCQ Attempt Interface
4. Submit Confirmation
5. Result Page
6. Review Page
7. My Attempts Page
8. Public content pages
9. Admin content UI
10. Admin mock-test builder UI

---

## Immediate Next Tasks

### T-32: Student Mock Test Listing Frontend

Use:

GET /api/student/mock-tests

Frontend should use:

studentAttemptSummary.primaryAction

Possible actions:

- start
- resume
- view_result
- view_review
- retake
- limit_reached

---

### T-33: Start/Resume Test Frontend

Use:

POST /api/student/mock-tests/:mockTestId/start

---

### T-34: MCQ Attempt Interface

Use:

PATCH /api/student/attempts/:attemptId/answer

POST /api/student/attempts/:attemptId/submit

---

## Security Rules

The following are non-negotiable:

1. Student test payload must not expose correct answers.
2. Student test payload must not expose solutions before allowed visibility.
3. Score must be calculated only on backend.
4. Student must access only own attempts.
5. Tenant isolation must always apply.
6. MockTestVersion snapshot must be used for attempts.
7. Public content can be public.
8. Mock tests require login.
9. PDF/e-book downloads require login unless explicitly made public.
10. Payment/referral money systems must be built with extra fraud checks.

---

## What We Are Not Building Immediately

Not immediate:

- Full LMS
- Live classes
- Mobile app
- AI doubt solver
- Drag-and-drop matching
- Full JEE/NEET engine
- Full CPCT typing engine
- Full analytics dashboard
- Referral payout automation
- Advanced admin visual builder

These come after the MCQ test frontend is usable.

---

## MVP Definition

PravixoEduTech Mock Test MVP is complete only when real students can:

1. See available mock tests.
2. Start/resume a test.
3. Answer MCQs.
4. Submit test.
5. View result.
6. View review if allowed.
7. See previous attempts.
8. Use a safe snapshot-based test engine.

Current status:

Backend: mostly complete for MCQ MVP.  
Frontend: pending.  
Advanced exams: pending.

---

## Final Lock

The mock test engine architecture is approved.

Do not redesign the foundation unless a security, scalability, or exam-rule issue is discovered.

Next step after this document:

T-32 — Student Mock Test Listing Frontend.
