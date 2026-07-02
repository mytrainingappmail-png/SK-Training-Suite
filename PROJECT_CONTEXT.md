# SK TRAINING SUITE LMS

Version: 1.0

Status: Active Development

---

# PROJECT IDENTITY

This project is a commercial SaaS Learning Management System (LMS).

It is NOT an HRMS.

Purpose:

Training & Development Platform for SMEs, Real Estate Companies, Sales Organizations and Enterprises.

---

# TECHNOLOGY

Frontend

- React
- Vite
- TypeScript
- Tailwind CSS

Backend

- Supabase

Architecture

- Repository Pattern
- Service Layer
- Component Based
- Strong TypeScript

---

# DEVELOPMENT RULES

Never redesign architecture.

Never rebuild completed modules.

Never rename folders unless instructed.

Always continue from existing code.

Always return COMPLETE FILES.

Never return snippets.

Never use placeholder code.

Never invent repository or service methods.

Use existing architecture only.

---

# PROJECT STRUCTURE

src/

components/

config/

constants/

database/

hooks/

layouts/

lib/

modules/

pages/

repositories/

services/

store/

types/

utils/

---

# REPOSITORY STRUCTURE

repositories/

company/

branch/

department/

designation/

role/

permission/

course/

assessment/

Every repository contains database access only.

No business logic.

---

# SERVICE STRUCTURE

services/

auth/

company/

branch/

department/

designation/

role/

permission/

course/

assessment/

Services call repositories.

Business logic stays here.

---

# UI STRUCTURE

Pages

↓

Components

↓

Services

↓

Repositories

↓

Supabase

↓

Database

Never bypass this architecture.

---

# CODING STANDARD

Every module must contain

Type

Repository

Service

UI

Validation

Loading State

Error Handling

Responsive Design

Permission Ready

Production Ready

---

# TYPESCRIPT RULES

No "any"

Strong typing only.

Prefer interfaces.

Shared types go into src/types.

---

# CURRENT DATABASE

companies

branches

departments

designations

roles

permissions

role_permissions

users

course_categories

courses

course_modules

lessons

learning_resources

---

# COMPLETED

React Setup

Tailwind

Supabase Connected

Authentication Foundation

Sidebar

Header

Dashboard

Admin Console

Company Module

Company CRUD

Company Repository

Company Service

Organization Database

RBAC Foundation

Course Database Foundation

Repository Cleanup

Branch Type

Branch Repository

Branch Service

---

# CURRENT SPRINT

Complete Branch Management.

Features required

Branch List

Add Branch

Edit Branch

Delete Branch

Search

Status

Head Office Toggle

Company Relationship

Supabase CRUD

Validation

Loading State

Empty State

Error Handling

---

# NEXT MODULES

Department Management

Designation Management

User Management

Course Categories

Courses

Modules

Lessons

Assessments

Certificates

Reports

---

# UI ROADMAP

Current UI is a functional developer interface.

Final UI will be redesigned later.

Target style

Premium SaaS

Modern

Minimal

Creative

Professional

Dark & Light Theme

Smooth Animations

Glass UI where appropriate

Dashboard with analytics

No redesign until functionality is complete.

---

# LONG TERM GOAL

Commercial multi-company LMS.

White Label Ready.

Cloud Ready.

Self Hosted Ready.

Docker Ready.

Windows Server Ready.

Linux VPS Ready.

No vendor lock-in.

---

# CHATGPT WORKFLOW

When continuing this project:

1.

Read this file first.

2.

Do NOT recreate completed modules.

3.

Do NOT redesign architecture.

4.

Ask only for the specific file that needs modification.

5.

Return complete files only.

6.

Mention clearly:

Create File

Replace File

Edit File

7.

Ensure code compiles.

8.

Keep architecture consistent.

---

# IMPORTANT

This project is being developed incrementally.

Never generate imaginary code.

Always integrate with the existing repository and service layer.

If a required file is missing, ask only for that file.