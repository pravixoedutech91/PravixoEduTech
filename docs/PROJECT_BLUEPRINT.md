# PravixoEduTech - Master Project Blueprint

## Project Overview

PravixoEduTech is a scalable educational technology platform focused initially on Hindi and English-medium and government-exam aspirants.

The platform will provide:

1. Government Job Notifications
2. Admit Cards
3. Results
4. Answer Keys
5. Syllabus
6. Current Affairs
7. Study Notes
8. SEO Articles
9. Mock Tests & PYQs
10. Subscription System
11. Referral System
12. LMS (Future Phase)
13. Multi-Tenant SaaS (Future Phase)

---

# Core Business Goal

Build an SEO-driven education platform that attracts users through:

* Government Job Updates
* Current Affairs
* Study Notes
* Exam Preparation Content

and converts them into:

* Mock Test Subscribers
* Course Purchasers
* LMS Students

---

# Development Philosophy

Build Once → Scale Later

Avoid future rewrites by creating:

* Database-driven architecture
* Multi-tenant-ready design
* No-code content management
* Modular backend services

---

# Technology Stack

## Frontend

* Next.js
* TypeScript
* Tailwind CSS

## Backend

* Node.js
* Express.js

## Database

* MongoDB Atlas

## Media Storage

* Cloudinary

## Payments

* Razorpay

## Deployment

Frontend:

* Vercel

Backend:

* Railway

Database:

* MongoDB Atlas

---

# Product Roadmap

## Phase 1

### Content Platform

* Articles
* Study Notes
* Current Affairs
* Government Job Notifications
* Exam Updates

### Authentication

* Mobile Number Login
* OTP Verification
* Password Reset

### Category Management

* Dynamic Categories
* Dynamic Exams

---

## Phase 2

### Mock Test Platform

Features:

* Mock Tests
* PYQs
* Exam-wise Tests
* Category-wise Tests
* Rank
* Analytics
* Performance Reports

Goal:

Subscription-based revenue.

---

## Phase 3

### Revenue System

* Subscription Plans
* Razorpay Integration
* Referral System
* Coupon System

---

## Phase 4

### LMS

* Recorded Courses
* Live Classes
* PDFs
* Assignments
* Student Dashboard
* Progress Tracking

---

## Phase 5

### Mobile App

* Android
* iOS

Built only after website success.

---

# Multi-Tenant SaaS Vision

Future architecture:

Super Admin

├── PravixoEduTech
├── Tenant A
├── Tenant B
├── Tenant C

Each tenant gets:

* Own Users
* Own Articles
* Own Notifications
* Own Mock Tests
* Own LMS
* Own Payments
* Own Referrals
* Own Branding

No tenant can access another tenant's data.

---

# Role System

## Super Admin

Can manage entire platform.

## Tenant Admin

Can manage own tenant.

## Content Manager

Can manage content only.

## Instructor

Can manage courses and classes.

## Student

Can consume content.

---

# Non-Technical Admin Requirement

After deployment:

No coding required for:

* Articles
* Study Notes
* Notifications
* Current Affairs
* Mock Tests
* Courses
* Payments
* Referrals

Everything must be manageable through Admin Panels.

---

# Database Collections

Current target collections:

* users
* tenants
* categories
* articles
* notifications
* tests
* questions
* testAttempts
* subscriptions
* payments
* referrals
* courses

---

# Architecture Rules

Rule 1

Never hardcode categories.

Rule 2

Never hardcode exams.

Rule 3

Everything should be database-driven.

Rule 4

Every model should be future-ready for tenantId support.

Rule 5

Every major feature should support:

* Create
* Read
* Update
* Delete

from Admin Panel.

---

# SEO Strategy

Target:

* SSC
* Railway
* UPSC
* MPPSC
* Banking
* Teaching
* State PSC

Content Types:

* Notes
* Current Affairs
* Exam Analysis
* Job Notifications
* Results
* Admit Cards

---

# Current Development Status

Completed:

✅ GitHub Repository

✅ Next.js Frontend Setup

✅ Express Backend Setup

✅ MongoDB Atlas Connected

✅ Category Model Created

✅ Category API Created

✅ First Database Write Successful

Next:

Article CMS Architecture

Then:

Notification System

Then:

Mock Test Engine

---

# Project Owner

PravixoEduTech

Master Blueprint Version: 1.0
