/*
===========================================================
SK TRAINING SUITE
Production Database Schema
Database : PostgreSQL / Supabase
Version  : 1.0
===========================================================

MODULES

1. Organization
   - Companies
   - Branches
   - Departments
   - Designations
   - Roles
   - Permissions
   - Users

2. Learning
   - Categories
   - Courses
   - Modules
   - Lessons
   - Resources
   - Assessments
   - Questions
   - Certificates
   - Learning Progress

3. Training Operations
   - Trainers
   - Batches
   - Sessions
   - Attendance

4. Administration
   - Branding
   - Theme
   - Menu
   - Notifications
   - Audit Logs
   - Settings

===========================================================
*//*
====================================================
SK TRAINING SUITE
Production Database Schema
Version 1.0
====================================================
*/

-- ==================================================
-- COMPANIES
-- ==================================================

CREATE TABLE companies (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    company_code VARCHAR(20) UNIQUE NOT NULL,

    company_name VARCHAR(200) NOT NULL,

    short_name VARCHAR(100),

    legal_name VARCHAR(250),

    website VARCHAR(255),

    email VARCHAR(150),

    phone VARCHAR(30),

    logo TEXT,

    favicon TEXT,

    address TEXT,

    city VARCHAR(100),

    state VARCHAR(100),

    country VARCHAR(100),

    pincode VARCHAR(20),

    gst_number VARCHAR(30),

    pan_number VARCHAR(30),

    timezone VARCHAR(100) DEFAULT 'Asia/Kolkata',

    currency VARCHAR(10) DEFAULT 'INR',

    language VARCHAR(30) DEFAULT 'English',

    theme VARCHAR(30) DEFAULT 'light',

    active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMP DEFAULT NOW(),

    updated_at TIMESTAMP DEFAULT NOW()

);-- ==================================================
-- BRANCHES
-- ==================================================

CREATE TABLE branches (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,

    branch_code VARCHAR(20),

    branch_name VARCHAR(150),

    contact_person VARCHAR(150),

    email VARCHAR(150),

    phone VARCHAR(30),

    address TEXT,

    city VARCHAR(100),

    state VARCHAR(100),

    country VARCHAR(100),

    pincode VARCHAR(20),

    head_office BOOLEAN DEFAULT FALSE,

    active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMP DEFAULT NOW(),

    updated_at TIMESTAMP DEFAULT NOW()

);-- ==================================================
-- DEPARTMENTS
-- ==================================================

CREATE TABLE departments (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    company_id UUID REFERENCES companies(id),

    branch_id UUID REFERENCES branches(id),

    department_code VARCHAR(20),

    department_name VARCHAR(150),

    description TEXT,

    active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMP DEFAULT NOW()

);-- ==================================================
-- DESIGNATIONS
-- ==================================================

CREATE TABLE designations (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    department_id UUID REFERENCES departments(id),

    designation_name VARCHAR(150),

    hierarchy_level INTEGER,

    active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMP DEFAULT NOW()

);