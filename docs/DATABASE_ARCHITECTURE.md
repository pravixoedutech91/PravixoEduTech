# PravixoEduTech - Database Architecture

Version: 1.0

---

# Architecture Goal

Current Mode:
- Single Tenant

Future Mode:
- Multi-Tenant SaaS

The database must support future SaaS expansion without major schema redesign.

---

# Tenant Strategy

Future collection:

tenants

Example:

{
  "_id": "...",
  "name": "PravixoEduTech",
  "slug": "pravixoedutech",
  "isActive": true
}

Future Rule:

Every major collection should eventually support:

tenantId

Example:

{
  "tenantId": "...",
  "title": "SSC CGL 2026"
}

This ensures tenant-level data isolation.

---

# Collections Overview

Phase 1

- users
- categories
- articles
- notifications

Phase 2

- tests
- questions
- testAttempts

Phase 3

- subscriptions
- payments
- referrals

Phase 4

- courses
- subjects
- topics
- lessons
- enrollments

Phase 5

- tenants
- tenantSettings

---

# Users Collection

Purpose:
Student Authentication & User Management

Fields:

- name
- mobile
- email
- password
- role
- isVerified
- referralCode
- referredBy
- status

Future:

- tenantId

Roles:

- superAdmin
- tenantAdmin
- contentManager
- instructor
- student

---

# Categories Collection

Purpose:

Master category management.

Examples:

- SSC
- Railway
- UPSC
- MPPSC
- Banking
- History
- Geography
- Polity

Fields:

- name
- slug
- description
- icon
- isActive

Future:

- tenantId

---

# Articles Collection

Purpose:

Study Notes
Current Affairs
SEO Articles

Fields:

- title
- slug
- category
- featuredImage
- content
- author
- tags
- seoTitle
- seoDescription
- status
- publishedAt

Future:

- tenantId

Status:

- draft
- published
- archived

---

# Notifications Collection

Purpose:

Government Job Updates

Fields:

- title
- slug
- shortDescription
- content
- category
- notificationType

Types:

- job
- admitCard
- result
- answerKey
- syllabus
- admission

Additional Fields:

- importantDates
- applicationFee
- ageLimit
- eligibility
- vacancyDetails
- importantLinks

Future:

- tenantId

---

# Tests Collection

Purpose:

Mock Test Management

Fields:

- title
- slug
- category
- duration
- totalQuestions
- totalMarks
- passingMarks
- instructions
- isPremium
- status

Future:

- tenantId

---

# Questions Collection

Purpose:

Mock Test Questions

Fields:

- testId
- question
- options
- correctAnswer
- explanation
- marks
- negativeMarks

Future:

- tenantId

---

# Test Attempts Collection

Purpose:

Student Performance Tracking

Fields:

- userId
- testId
- score
- rank
- accuracy
- timeTaken

Future:

- tenantId

---

# Subscriptions Collection

Purpose:

Premium Access

Fields:

- userId
- planName
- startDate
- endDate
- status

Future:

- tenantId

---

# Payments Collection

Purpose:

Payment Tracking

Fields:

- userId
- amount
- paymentGateway
- transactionId
- paymentStatus

Future:

- tenantId

Gateway:

- Razorpay

---

# Referrals Collection

Purpose:

Referral Program

Fields:

- referrerId
- referredUserId
- reward
- status

Future:

- tenantId

---

# Courses Collection

Purpose:

LMS System

Fields:

- title
- slug
- description
- instructor
- price
- thumbnail
- status

Future:

- tenantId

---

# Subjects Collection

Purpose:

Course Subjects

Fields:

- courseId
- title
- description

Future:

- tenantId

---

# Topics Collection

Purpose:

Course Topics

Fields:

- subjectId
- title
- order

Future:

- tenantId

---

# Lessons Collection

Purpose:

Video/PDF Content

Fields:

- topicId
- title
- videoUrl
- pdfUrl
- duration

Future:

- tenantId

---

# Enrollments Collection

Purpose:

Student Course Access

Fields:

- userId
- courseId
- enrollmentDate
- expiryDate

Future:

- tenantId

---

# Architectural Rules

1. No hardcoded categories.

2. No hardcoded exams.

3. No hardcoded courses.

4. All content manageable from Admin Panel.

5. Every model should be tenant-ready.

6. Avoid schema changes that require rewriting existing collections.

7. Prefer configuration-driven architecture over code-driven architecture.

---

# Current Progress

Completed:

✅ MongoDB Atlas Connected

✅ Category Model

✅ Category API

Next:

- Article CMS
- Notification System
- Mock Test Engine
- Payment System
- LMS
