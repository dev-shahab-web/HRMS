# MASTER PROMPT — BUILD A PRODUCTION-GRADE MULTI-TENANT HRMS SaaS

You are acting as the Principal Software Architect, CTO, Senior Product Engineer, Security Engineer, DevOps Engineer, UI/UX Lead, QA Lead and Database Architect for this project.

Your task is to design and build a production-grade, enterprise-ready, configurable HRMS SaaS platform with:

* Web application
* Android application
* iPhone/iOS application
* SaaS Super Admin panel
* Company/Tenant Admin panel
* HR/Admin application
* Manager application
* Employee Self-Service application
* Recruitment/ATS
* Payroll and taxation
* Attendance
* Shifts
* Geofencing/location attendance
* Timesheets/worklogs
* Leave management
* Employee lifecycle
* Document management
* Offer/letter/document generation
* Reporting
* Subscription/feature management
* Multi-tenant and multi-company architecture

This is NOT a prototype.

Do not build a toy CRUD application.

Architect the system so that it can eventually support thousands of companies and hundreds of thousands or millions of employees.

The initial infrastructure should be optimized for Cloudflare, but the domain/business layer must remain sufficiently portable so that individual infrastructure components can later be moved to AWS, GCP or another provider without rewriting the entire product.

---

# 1. PRODUCT VISION

Build a configurable HRMS SaaS similar in scope to products such as:

* Darwinbox
* Keka
* Zoho People
* BambooHR
* Rippling
* Deel
* greytHR

Do NOT clone their UI, branding or proprietary implementation.

Instead build a modern, premium HR platform with excellent UX.

The platform must support:

Platform
→ Tenant / Customer Account
→ One or more Companies / Legal Entities
→ Business Units
→ Departments
→ Locations
→ Cost Centres
→ Teams
→ Employees

Example:

Tenant: ABC Group

Companies:

* ABC Technologies Pvt Ltd
* ABC Consulting Pvt Ltd
* ABC UAE LLC

Each company may have different:

* payroll
* tax configuration
* currencies
* policies
* holidays
* attendance rules
* locations
* departments
* salary structures
* compliance requirements

Users may have access to one or multiple companies depending on their role.

---

# 2. NON-NEGOTIABLE ARCHITECTURE PRINCIPLES

The following are mandatory.

## Multi-tenancy

Every business record must be tenant isolated.

Never trust tenant IDs coming directly from the client.

Tenant context must originate from authenticated server-side session/context.

Every tenant-scoped table should contain appropriate tenant_id references.

Use defense-in-depth tenant isolation.

Where practical use:

* PostgreSQL Row Level Security
* tenant-scoped database repositories
* composite unique constraints containing tenant_id
* authorization checks at service layer
* automated cross-tenant leakage tests

Never allow a query such as:

SELECT * FROM employees

without tenant isolation in application/domain code.

Create automated security tests proving that Tenant A cannot access Tenant B's:

* employees
* documents
* payroll
* attendance
* reports
* candidates
* settings
* files
* invoices

---

# 3. RECOMMENDED TECHNOLOGY STACK

Use current stable versions at implementation time.

Before installing dependencies, verify the latest stable compatible versions.

Do NOT blindly use versions specified in this prompt if newer stable versions exist.

## Monorepo

Use:

* pnpm
* Turborepo
* TypeScript
* strict TypeScript configuration

Recommended structure:

apps/
web/
mobile/
api/
platform-admin/
worker-jobs/

packages/
database/
auth/
api-client/
validation/
domain/
payroll-engine/
attendance-engine/
permissions/
feature-flags/
ui/
design-tokens/
email/
documents/
notifications/
observability/
config/
testing/

infrastructure/
cloudflare/
migrations/
scripts/

docs/
product/
architecture/
database/
api/
security/
decisions/

---

# 4. WEB APPLICATION

Use:

* React
* TypeScript
* React Router v8 full-stack framework
* Vite
* Cloudflare Vite integration
* Tailwind CSS
* shadcn/ui or an equivalent high-quality accessible component system
* Radix primitives where appropriate
* TanStack Query
* TanStack Table
* React Hook Form
* Zod
* date-fns or Temporal-compatible abstraction
* Recharts/ECharts where appropriate for analytics

Deploy on:

Cloudflare Workers

Do not unnecessarily tightly couple business logic to React Router.

The web frontend should call the same API used by mobile.

---

# 5. BACKEND API

Use:

* TypeScript
* Hono
* Cloudflare Workers
* REST API designed with OpenAPI
* Zod validation
* versioned API routes

Example:

/api/v1/auth
/api/v1/employees
/api/v1/attendance
/api/v1/payroll
/api/v1/recruitment

Generate an OpenAPI specification automatically where practical.

Generate typed API clients for:

* web
* mobile
* future third-party integrations

Use consistent:

* pagination
* sorting
* filtering
* search
* validation
* standardized errors
* request IDs
* correlation IDs

Error format should be structured.

Example concept:

{
"error": {
"code": "ATTENDANCE_OUTSIDE_GEOFENCE",
"message": "...",
"requestId": "...",
"details": {}
}
}

Never expose stack traces or internal details to production clients.

---

# 6. MOBILE APPLICATION

Build ONE mobile codebase for Android and iPhone.

Use:

* Expo
* React Native
* TypeScript
* Expo Router
* TanStack Query
* secure local storage
* native location APIs
* push notifications
* camera/document upload
* biometric unlock where appropriate

Support:

* Android
* iOS

Plan for:

* EAS Build
* EAS Submit
* EAS Update
* development builds

The mobile application must be employee-friendly and optimized around frequent actions.

Home should prominently support things like:

* Check In / Check Out
* current attendance state
* shift information
* leave balance
* request leave
* pending approvals
* payslips
* announcements
* timesheet
* profile
* documents

Mobile should NOT simply be the desktop UI resized.

Design dedicated mobile workflows.

---

# 7. DATABASE

Primary database:

PostgreSQL.

Use Cloudflare Hyperdrive between Workers and PostgreSQL where appropriate.

Use:

* Drizzle ORM
* Drizzle migrations
* raw SQL where required for advanced database behavior

Do not use ORM abstractions blindly for complex reporting/payroll calculations.

Create proper:

* primary keys
* foreign keys
* indexes
* composite indexes
* unique constraints
* check constraints

Use UUID/UUIDv7 or another appropriately scalable identifier strategy.

Never use employee email or employee code as the main database primary key.

---

# 8. DATABASE PORTABILITY

Database design must work on standard PostgreSQL.

Avoid relying on vendor-specific PostgreSQL extensions unless there is a compelling reason.

Create clean database migrations.

Migrations must:

* be version controlled
* be reproducible
* support staging
* support production
* avoid destructive schema changes without migration strategy

---

# 9. CLOUD INFRASTRUCTURE

Use Cloudflare-first architecture.

Use:

Cloudflare Workers
→ APIs and server-side application logic

Cloudflare R2
→ employee documents
→ resumes
→ offer letters
→ payslips
→ policy documents
→ generated letters
→ attachments
→ exports

Cloudflare Queues
→ asynchronous tasks

Examples:

* emails
* notifications
* report generation
* bulk imports
* file processing
* webhook processing
* payroll side jobs

Cloudflare Workflows
→ long-running/durable business workflows

Examples:

* onboarding workflow
* resignation/offboarding
* hiring approvals
* payroll processing
* offer approvals
* employee approval chains
* subscription lifecycle
* document generation
* bulk employee import

Cloudflare Turnstile
→ web signup/login/forgot-password abuse protection where appropriate

Cloudflare Browser Run
→ PDF generation from HTML/CSS where appropriate

Cloudflare KV
→ only for suitable ephemeral/cached/configuration data

DO NOT use KV as the source of truth for payroll or employee records.

---

# 10. FILE STORAGE

Use R2.

Files must NOT be publicly accessible by default.

Use controlled/signed access.

File records in PostgreSQL should contain metadata such as:

* id
* tenant_id
* company_id
* owner/entity
* R2 object key
* original filename
* mime type
* file size
* SHA/checksum
* document type
* document category
* upload date
* uploaded_by
* expiration date
* version
* status
* metadata
* retention policy

R2 object key convention should include tenant isolation.

Example concept:

tenants/{tenantId}/companies/{companyId}/employees/{employeeId}/documents/{documentId}/file

Never rely only on obscurity of an R2 object key for authorization.

---

# 11. AUTHENTICATION

Implement secure authentication.

Prefer a well-maintained authentication framework/library rather than inventing cryptography.

Requirements:

* email/password
* passwordless capability
* MFA/TOTP ready
* SSO/OIDC ready
* Google/Microsoft SSO ready
* session management
* refresh/session rotation where appropriate
* logout all devices
* login audit logs
* trusted devices
* secure password reset
* account lockout/rate limiting
* invitation workflow

Architecture must eventually support enterprise:

* SAML
* OIDC
* SCIM

Keep authentication identity separate from employee employment record.

One person/user may:

* belong to multiple tenants
* have different roles in different tenants
* have multiple employment relationships if required

---

# 12. AUTHORIZATION

Do not build simplistic:

role = admin

authorization.

Build RBAC with permission capabilities.

Examples:

employee.read
employee.create
employee.update
employee.compensation.read
employee.compensation.update
payroll.read
payroll.process
payroll.approve
attendance.manage
recruitment.manage
documents.manage

Provide standard roles:

* Platform Super Admin
* Tenant Owner
* Company Admin
* HR Admin
* Payroll Admin
* Recruiter
* Manager
* Department Head
* Finance
* Employee
* Auditor
* Custom Role

Allow tenants to create custom roles.

Support data scopes:

* self
* direct reports
* indirect reports
* department
* business unit
* location
* company
* entire tenant

Example:

Manager can read attendance for direct reports but cannot read their payroll.

Authorization must be checked SERVER SIDE.

UI hiding alone is not authorization.

---

# 13. SAAS PLATFORM / SUPER ADMIN

Build a completely separate Platform Admin experience.

Platform Super Admin must manage:

* tenants
* companies
* subscriptions
* plans
* feature entitlements
* trial periods
* billing status
* usage limits
* users
* support requests
* system health
* tenant suspension
* feature overrides
* add-ons
* API usage
* storage usage
* employee count
* audit logs
* system announcements

Ability to see tenant overview.

Avoid unrestricted impersonation.

If support impersonation is implemented:

* require explicit permission
* require reason
* audit the session
* show visible impersonation banner
* record start/end
* restrict sensitive actions where appropriate

---

# 14. SUBSCRIPTION & ENTITLEMENT ENGINE

Do NOT hardcode features based on plan names.

Create a proper entitlement system.

Example plans:

Starter
Growth
Professional
Enterprise

Example features:

core_hr
attendance
geofencing
leave
timesheets
payroll
recruitment
performance
expenses
assets
advanced_reports
api_access
sso
custom_roles
custom_workflows

Feature entitlement should support:

* enabled/disabled
* numeric limit
* usage limit
* tenant override
* trial override
* add-on
* effective dates

Examples:

employees.max = 50

locations.max = 3

companies.max = 1

storage_gb.max = 10

recruitment.enabled = false

payroll.enabled = true

Enforcement MUST happen server-side.

Do not only disable menu items.

Create:

canUseFeature()
getFeatureLimit()
checkUsageLimit()

or similar centralized entitlement APIs.

---

# 15. BILLING

Implement billing abstraction.

Prepare providers for:

* Stripe
* Razorpay
* manual invoice/offline payment
* future providers

The domain should not be tightly coupled to Stripe.

Support:

* monthly
* annual
* per employee pricing
* flat pricing
* hybrid pricing
* add-ons
* coupons
* trials
* grace period
* plan upgrades
* downgrades
* subscription pause
* cancellation
* payment failed status

Use webhook processing.

Webhook processing must be:

* signature validated
* idempotent
* logged
* asynchronous where appropriate

---

# 16. TENANT & COMPANY CONFIGURATION

Tenant setup wizard should support:

* organization name
* logo
* branding
* primary timezone
* default currency
* default language
* financial year
* week start day
* date format
* time format

Company/legal entity:

* legal name
* trade name
* registration information
* tax IDs
* addresses
* payroll configuration
* bank details
* company logo
* country
* state/province
* timezone
* currency

Do NOT make India-specific fields mandatory globally.

Use country-specific configuration schemas.

---

# 17. ORGANIZATION STRUCTURE

Support:

* Company
* Business Unit
* Division
* Department
* Sub-department
* Team
* Cost Centre
* Location
* Designation
* Job Level
* Grade
* Employment Type

Employment types:

* Permanent
* Contract
* Intern
* Consultant
* Temporary
* Custom

Support reporting hierarchy.

Employee can have:

* reporting manager
* dotted-line manager
* department head
* HR partner

Keep organizational history effective-dated where appropriate.

---

# 18. CORE HR / EMPLOYEE INFORMATION SYSTEM

Employee profile should support:

Personal:

* profile photo
* legal name
* preferred name
* date of birth
* gender where legally/applicably collected
* contact information
* address
* emergency contacts
* nationality
* marital status where applicable

Employment:

* employee ID/code
* company
* department
* manager
* designation
* grade
* job title
* location
* joining date
* probation
* confirmation date
* employment status
* employment type
* work email
* work phone
* cost centre

Bank/payroll information

Government/statutory IDs using country-specific configurable modules.

Education

Previous employment

Skills

Certifications

Dependents

Emergency contacts

Documents

Assets

Compensation history

Job history

Manager history

Status history

Do not overwrite important historical employment data.

Use effective-dated records where history matters.

---

# 19. CUSTOM FIELDS

This is essential for SaaS configurability.

Allow company administrators to define custom fields for entities such as:

* employee
* candidate
* job
* asset
* attendance request
* leave request

Field types:

* text
* long text
* number
* currency
* date
* datetime
* boolean
* select
* multi-select
* user
* department
* location
* URL
* email
* phone

Support:

* required
* optional
* validation
* default values
* visibility rules
* role permissions

Avoid creating database columns dynamically.

Use a safe metadata/value architecture.

---

# 20. EMPLOYEE LIFECYCLE

Support:

Preboarding
Onboarding
Probation
Confirmation
Promotion
Transfer
Salary revision
Role change
Location transfer
Manager change
Resignation
Termination
Retirement
Offboarding
Alumni

Each lifecycle event should support:

* effective date
* approvals
* documents
* notifications
* history
* comments
* audit trail

---

# 21. ONBOARDING

Create configurable onboarding templates.

Tasks may be assigned to:

* employee
* HR
* manager
* IT
* finance
* admin

Examples:

* upload identity documents
* sign policies
* bank information
* equipment request
* email account creation
* orientation
* team introduction
* background verification

Track:

* pending
* in progress
* completed
* overdue
* skipped

---

# 22. RECRUITMENT / ATS

Build a complete Applicant Tracking System.

Modules:

Job Requisition

* requisition ID
* department
* hiring manager
* recruiter
* number of openings
* employment type
* location
* budget
* justification
* approval workflow

Job Posting

* internal
* public careers portal
* external integration-ready

Candidate

* personal details
* resume
* source
* skills
* experience
* salary information
* notice period
* attachments
* notes
* tags

Pipeline

Configurable stages such as:

Applied
Screening
Assessment
Interview 1
Interview 2
HR Round
Offer
Hired
Rejected

Allow customers to customize stages.

Interview scheduling:

* interviewer
* date/time
* meeting link
* scorecard
* feedback

Candidate scorecards.

Offer approval.

Offer letter generation.

Offer acceptance/rejection.

Candidate → employee conversion.

Preserve candidate history after hiring.

Create privacy/data retention controls for candidate data.

---

# 23. CAREERS PORTAL

Provide tenant/company branded careers pages.

Support:

* logo
* colors
* company description
* job listings
* job search
* filters
* application forms
* custom candidate fields
* resume upload

URLs should support configurable tenant routes/subdomains later.

Example:

careers.product.com/company-name

or eventually:

careers.company.com

---

# 24. OFFER LETTERS & HR LETTERS

Build a generic document-template engine.

Templates should support:

* rich text
* HTML
* CSS
* company logo
* letterhead
* placeholders
* conditional sections
* tables
* signatures

Example variables:

{{employee.full_name}}
{{employee.employee_code}}
{{employee.designation}}
{{employee.joining_date}}
{{employee.salary.ctc}}
{{company.legal_name}}
{{manager.name}}

Generate:

* offer letter
* appointment letter
* confirmation letter
* promotion letter
* increment letter
* transfer letter
* warning letter
* experience letter
* relieving letter
* employment certificate
* salary certificate
* custom documents

Render final documents into PDF.

Store generated copies immutably where appropriate.

Do not regenerate historic salary letters from current employee salary.

The generated document must retain the data snapshot used at generation time.

---

# 25. DOCUMENT MANAGEMENT

Support:

Employee Documents
Company Documents
Policies
Letters
Certificates
Contracts
Candidate Documents
Payroll Documents

Features:

* folders/categories
* versions
* access permissions
* expiry dates
* reminders
* acknowledgment
* e-signature-ready abstraction
* document preview
* download
* audit trail

Policies should support:

Published
Acknowledgment Required
Acknowledged
Not Acknowledged

---

# 26. ATTENDANCE

Attendance is a major module.

Build a powerful attendance engine.

Support attendance methods:

* Mobile GPS
* Web
* Kiosk
* Manual HR entry
* API/import
* Biometric device integration-ready
* QR code optional

Every attendance event should retain:

* employee
* tenant
* company
* timestamp
* server received timestamp
* timezone
* attendance action
* source
* latitude
* longitude
* GPS accuracy
* device information where appropriate
* IP address where appropriate
* location/geofence result
* shift
* offline indicator
* metadata

Server time should be authoritative for security-sensitive decisions.

Do not blindly trust device clock.

---

# 27. LOCATION / GEOFENCING ATTENDANCE

Create Work Locations.

Each can define:

* latitude
* longitude
* allowed radius
* timezone
* address
* active status

Attendance policy should configure:

* location required?
* allowed locations
* GPS accuracy threshold
* allow remote?
* allow outside geofence with reason?
* require approval outside geofence?
* require photo/selfie?
* require Wi-Fi?
* allowed IP?
* device restriction?
* offline attendance permitted?

Calculate distance server-side.

Store:

* submitted coordinates
* calculated distance
* geofence used
* accuracy
* decision

Privacy:

Do NOT continuously track employee location by default.

Collect location only where required by configured attendance/field-work policies.

Make location behavior transparent to employees.

---

# 28. MOBILE ATTENDANCE SECURITY

Implement best-effort fraud protections without claiming they are impossible to bypass.

Consider:

* mock location detection on Android
* jailbreak/root signals
* device integrity/attestation abstraction
* impossible travel detection
* duplicate punches
* configurable trusted devices
* GPS accuracy threshold
* server timestamps
* request signing/session validation

Do not block legitimate users solely because GPS accuracy is temporarily poor.

Use configurable fallback/approval workflows.

---

# 29. OFFLINE ATTENDANCE

Mobile app should support controlled offline check-in where company policy permits it.

Store:

* device timestamp
* coordinates
* accuracy
* local event ID
* cryptographic/session metadata if feasible

Upon reconnect:

sync events.

Server records:

* original device timestamp
* server received timestamp
* delayed sync
* offline status

Offline punches should be visibly distinguishable for auditing.

Prevent duplicate sync using idempotency keys.

---

# 30. SHIFT MANAGEMENT

Support:

* General shift
* Fixed shift
* Flexible shift
* Rotational shift
* Night shift
* Overnight shift
* Split shift
* Custom shift

Shift settings:

* start time
* end time
* break
* minimum hours
* full-day hours
* half-day hours
* grace period
* late coming rules
* early leaving rules
* overtime
* minimum overtime
* maximum overtime
* weekly offs

Shift assignment:

* employee
* department
* location
* roster
* effective date

Support future shift rosters.

Handle shifts crossing midnight correctly.

Time calculations must be timezone-safe.

---

# 31. ATTENDANCE PROCESSING

Build an attendance calculation engine.

Derive:

* Present
* Absent
* Half Day
* Leave
* Holiday
* Weekly Off
* Missing Punch
* Late
* Early Exit
* Work From Home
* On Duty

Do not permanently store only derived values without retaining raw punch events.

Raw events should be immutable/auditable.

Create attendance regularization:

Employee requests correction
→ Manager approves
→ HR optionally approves
→ attendance recalculated

Maintain audit trail of original and corrected values.

---

# 32. LEAVE MANAGEMENT

Build configurable leave policies.

Leave types:

* Casual
* Sick
* Earned
* Privilege
* Unpaid
* Maternity
* Paternity
* Comp Off
* Bereavement
* Work From Home
* Custom

Policy features:

* annual entitlement
* monthly accrual
* prorating
* carry forward
* maximum carry forward
* expiry
* encashment
* negative balance
* sandwich rules
* probation restrictions
* gender/eligibility rules where lawful
* minimum notice
* maximum consecutive days
* attachment required
* half day
* hourly leave if enabled

Leave year can differ from calendar year.

Build ledger-based leave balances.

Never calculate balance purely from a mutable number field.

Use transactions/ledger entries.

---

# 33. HOLIDAY CALENDAR

Support multiple holiday calendars.

Assign by:

* company
* location
* department
* employee

Types:

* mandatory
* optional/restricted
* regional

Support calendar import.

---

# 34. TIMESHEET / WORKSHEET / WORKLOG

Build:

Projects
Clients
Tasks
Activities
Timesheets

Employees can record:

* date
* project
* task
* activity
* start/end time
* duration
* billable/non-billable
* comments
* attachments

Support:

* daily
* weekly timesheets
* timer mode
* manual entries
* approval
* rejection
* resubmission
* locking after approval

Managers can see:

* utilization
* employee hours
* project hours
* overtime
* billable utilization

Ensure timesheet and attendance remain separate concepts.

Optionally provide reconciliation between them.

---

# 35. PAYROLL

Payroll must be architected as a serious financial calculation subsystem.

Do NOT sprinkle payroll calculations through UI/API controllers.

Create an isolated payroll domain engine.

Concepts:

* Payroll Calendar
* Pay Group
* Pay Frequency
* Payroll Period
* Employee Compensation
* Salary Structure
* Salary Component
* Earning
* Deduction
* Employer Contribution
* Reimbursement
* Benefit
* Tax
* Arrear
* Adjustment
* Loan
* Bonus
* Overtime
* Final Settlement

Salary components should support:

* fixed amount
* percentage
* formula
* dependent component
* taxable flag
* recurring/non-recurring
* employer contribution
* employee deduction
* proratable
* country localization

---

# 36. PAYROLL RULE ENGINE

Build an effective-dated payroll rule system.

Never hardcode current statutory rates inside random application code.

Country/localization packages should be versioned.

Concept:

packages/payroll-engine/
core/
countries/
IN/
AE/
US/
...

Only implement localization rules that are explicitly being targeted and validated.

When implementing country-specific taxation, statutory contributions or compliance:

* separate rules from engine
* store effective dates
* preserve historic rule versions
* write regulatory test cases
* expose configuration
* document source assumptions
* require human/accounting validation before production deployment

Never silently update historical payroll calculations when statutory rules change.

---

# 37. INDIA PAYROLL LOCALIZATION

Design the platform so an India localization package can support items such as:

* Basic
* HRA
* allowances
* bonus
* deductions
* PF
* ESI
* Professional Tax
* Labour Welfare Fund
* gratuity calculations where applicable
* income tax/TDS
* tax regime configuration
* tax declarations
* exemptions/deductions where applicable
* previous employment income
* investment declaration
* proof submission

However:

DO NOT assume rates/thresholds remain static.

All statutory rules must be effective-dated and validated against current law before production use.

State-specific rules must not be represented as one national constant.

Architecture should allow additional country packs later.

---

# 38. COMPENSATION

Employee compensation history must be immutable/effective-dated.

Support:

* annual CTC
* monthly gross
* salary structure
* effective from
* revision reason
* approved by
* salary components

Do not overwrite prior compensation.

---

# 39. PAYROLL PROCESS

Design payroll states:

Draft
Input Collection
Calculation
Validation
Review
Approved
Locked
Payment Processing
Completed

Payroll run should:

1. create payroll run
2. freeze employee population
3. capture attendance/leave inputs
4. capture salary inputs
5. calculate earnings
6. calculate deductions
7. calculate tax
8. calculate employer contributions
9. calculate arrears/adjustments
10. produce validation exceptions
11. allow authorized review
12. approve
13. lock
14. generate payslips
15. generate bank/payment outputs
16. create accounting/export data

A locked payroll run must not be silently mutated.

Corrections should be handled through adjustment/reversal/re-run processes.

---

# 40. PAYSLIPS

Generate branded PDF payslips.

Payslip must show configurable sections.

Example:

* employee information
* earnings
* deductions
* employer contributions if configured
* tax
* net salary
* attendance summary
* bank/payment details partially masked
* YTD values

Provide:

* employee view
* PDF
* bulk generation
* bulk notification

Payslips are sensitive documents.

Use strict authorization.

---

# 41. TAX DECLARATION

Provide employee tax declaration workflow where relevant.

Features:

* declaration categories
* amount
* attachments
* evidence
* verification status
* reviewer
* comments

Statuses:

Draft
Submitted
Under Review
Approved
Rejected
Partially Approved

Maintain full audit history.

---

# 42. LOANS / ADVANCES

Support optional employee:

* loans
* salary advances

Track:

* principal
* installments
* balance
* repayment schedule
* payroll deduction
* early closure
* adjustment

---

# 43. EXPENSE / REIMBURSEMENT

Support:

* expense categories
* claims
* receipts
* mileage
* approval workflows
* finance verification
* payroll reimbursement
* direct reimbursement

Allow company-configured limits.

---

# 44. APPROVAL ENGINE

Build a reusable approval workflow engine rather than hardcoding approvals separately in every module.

Entities may include:

* leave
* regularization
* timesheet
* offer
* requisition
* salary revision
* resignation
* expense
* document
* employee change

Workflow can define:

Step 1 Manager
Step 2 Department Head
Step 3 HR
Step 4 Finance

Support:

* sequential approval
* parallel approval
* conditional steps
* auto approval
* escalation
* delegate
* skip rules

Conditions examples:

amount > X
leaveDays > Y
department = Z
employeeGrade = A

Maintain workflow instance snapshot so later configuration changes do not rewrite existing workflows.

---

# 45. PERFORMANCE MANAGEMENT

Build modular performance functionality.

Support:

* review cycles
* goals
* KPIs
* OKRs
* competencies
* self-review
* manager review
* peer review
* 360 review
* rating scales
* calibration-ready architecture
* development plans
* comments

Feature should be subscription-controlled.

---

# 46. ASSET MANAGEMENT

Track company assets.

Examples:

* laptop
* phone
* SIM
* ID card
* monitor
* vehicle
* equipment

Fields:

* asset ID
* serial
* category
* model
* purchase date
* warranty
* status
* assigned employee
* issued date
* returned date

Integrate with onboarding/offboarding.

---

# 47. OFFBOARDING

Support:

* resignation request
* notice period
* last working day
* manager approval
* HR approval
* knowledge transfer
* asset return
* access revoke checklist
* exit interview
* final settlement
* relieving letter
* experience letter

Use configurable offboarding templates.

---

# 48. ANNOUNCEMENTS

Support:

* company announcements
* department announcements
* location targeting
* acknowledgement
* attachments
* scheduled publishing
* expiry date

Show relevant announcements in web/mobile dashboard.

---

# 49. EMPLOYEE REQUEST / HELP DESK

Create an optional employee service desk.

Categories:

* HR
* Payroll
* IT
* Admin
* Finance
* Custom

Support:

Open
In Progress
Waiting
Resolved
Closed

SLA-ready architecture.

---

# 50. NOTIFICATIONS

Create centralized notification service.

Channels:

* In-app
* Email
* Push
* SMS provider abstraction
* WhatsApp provider abstraction

Notification events examples:

* leave submitted
* leave approved
* payslip released
* offer sent
* document expiring
* interview scheduled
* timesheet pending
* attendance regularization
* employee birthday
* onboarding task
* payroll completed

Users should have notification preferences where appropriate.

Do not send sensitive information unnecessarily through insecure channels.

---

# 51. EMAIL TEMPLATES

Configurable email templates.

Allow tenant branding.

Template variables must be validated.

Prevent arbitrary server-side code execution from templates.

---

# 52. REPORTING

Build reporting architecture from the beginning.

Standard reports:

Employee

* headcount
* department headcount
* location headcount
* joining
* exits
* attrition
* employee master

Attendance

* daily attendance
* monthly muster
* late coming
* overtime
* missing punches

Leave

* balances
* transactions
* utilization

Payroll

* payroll register
* salary register
* deduction reports
* component reports
* tax reports

Recruitment

* pipeline
* source
* time-to-hire
* offer acceptance

Timesheet

* utilization
* project hours
* billable hours

Reports should support:

* date filtering
* company
* department
* employee
* location
* export CSV
* export Excel
* PDF where appropriate

Large exports should run asynchronously.

---

# 53. DASHBOARDS

Create role-specific dashboards.

Employee:

* attendance
* shift
* leave balance
* holidays
* payslip
* tasks
* announcements

Manager:

* team attendance
* pending approvals
* team leave
* missing timesheets
* upcoming events

HR:

* headcount
* attendance exceptions
* onboarding
* exits
* recruitment
* employee changes

Payroll:

* payroll status
* anomalies
* pending inputs
* payroll periods

Platform admin:

* tenants
* subscriptions
* MRR metrics-ready
* active users
* employee counts
* storage
* system errors

---

# 54. SEARCH

Implement global search.

Search:

* employees
* candidates
* departments
* documents where authorized
* jobs

Never return unauthorized entities in search.

---

# 55. AUDIT LOG

Create enterprise-grade immutable audit logging.

Audit sensitive actions including:

* employee changes
* compensation changes
* payroll
* permission changes
* role changes
* documents
* approvals
* login/security
* tenant admin
* support impersonation
* subscription overrides

Store:

* actor
* tenant
* company
* action
* entity
* entity ID
* before
* after
* timestamp
* request ID
* IP where appropriate
* source

Sensitive values such as passwords/tokens must NEVER enter audit logs.

Consider masking highly sensitive fields.

---

# 56. SOFT DELETE & RETENTION

Do not use soft-delete blindly on every table.

Classify data.

For some entities use:

* archived state
* effective end date
* soft delete
* immutable financial history

For privacy-related deletion, support appropriate anonymization/retention workflows.

Payroll/audit records may have legal retention requirements depending on jurisdiction.

Keep retention configurable.

---

# 57. SECURITY

Follow OWASP best practices.

Mandatory:

* server-side authorization
* tenant isolation
* parameter validation
* output escaping
* CSRF protection where applicable
* CSP
* secure cookies
* HTTPS only
* secret management
* rate limiting
* brute force protection
* SQL injection protection
* XSS prevention
* SSRF prevention
* safe file upload validation
* MIME verification
* file size limits
* audit logging

Never log:

* passwords
* reset tokens
* session tokens
* complete bank information
* sensitive government IDs

Encrypt highly sensitive fields at application level where appropriate.

Design a key-management abstraction so Cloudflare/AWS/GCP KMS-style implementations can be swapped later.

---

# 58. PII

Employee information is sensitive.

Implement field-level permission rules for sensitive categories such as:

* compensation
* taxation
* bank information
* government identifiers
* medical/accommodation information if ever supported

A manager should not automatically receive access to every private HR field.

---

# 59. DATA IMPORT

Build robust bulk import.

Supported:

* CSV
* Excel

Examples:

* employees
* attendance
* salary data
* opening leave balances
* assets
* candidates

Import workflow:

Upload
→ Parse
→ Map columns
→ Validate
→ Preview
→ Report errors
→ Import valid data

Do not partially import silently.

Provide downloadable error report.

Large imports should use background processing.

---

# 60. API INTEGRATIONS

Design integrations framework.

Prepare for:

* biometric devices
* accounting systems
* banks
* job boards
* background verification
* e-signature
* email
* SMS
* WhatsApp
* calendars
* Microsoft
* Google Workspace

Provide API keys/service accounts for customers in higher plans.

API keys should have:

* hashed secret storage
* scopes
* expiration
* last used
* revocation

---

# 61. WEBHOOKS

Allow outbound webhooks.

Events:

employee.created
employee.updated
attendance.checked_in
leave.approved
payroll.completed
candidate.hired

Requirements:

* webhook signing
* retries
* exponential backoff
* delivery logs
* manual retry
* secret rotation

---

# 62. UI / UX PRINCIPLES

The UI must feel premium.

Think:

* modern B2B SaaS
* clean
* spacious
* fast
* professional
* information dense when required without being cluttered

Do NOT produce generic bootstrap-style admin UI.

Design system should include:

* typography
* spacing
* colors
* elevation
* borders
* form patterns
* tables
* cards
* dialogs
* sheets
* alerts
* badges
* status indicators
* empty states
* error states
* loading states
* skeletons

Support:

* responsive design
* desktop
* tablet
* accessibility
* keyboard navigation
* WCAG considerations
* light mode
* dark mode architecture

Use clear semantic status colors but do not rely on color alone.

---

# 63. DESIGN TOKENS

Create shared design tokens.

Examples:

* colors
* radius
* spacing
* typography
* motion
* shadows

Web and mobile should share brand tokens where reasonable.

Do not try to share every UI component between React web and React Native.

Share:

* design language
* API types
* business logic
* validation
* tokens

not inappropriate DOM-specific components.

---

# 64. TABLE UX

HR software contains large tables.

Build excellent table UX:

* server pagination
* sorting
* filtering
* search
* column visibility
* sticky headers
* bulk actions
* export
* saved views later
* loading states
* row actions

Avoid fetching 100,000 employees into the browser.

---

# 65. FORM UX

Forms need:

* inline validation
* field descriptions
* required indicator
* draft saving where needed
* unsaved change warning
* logical sections
* keyboard navigation

Avoid giant 80-field single-page forms.

Use sections/tabs/steps.

---

# 66. TIME / DATE ENGINEERING

HR systems are extremely sensitive to date/time bugs.

Rules:

Store timestamps in UTC.

Store timezone explicitly where necessary.

Use IANA timezone strings.

Examples:

Asia/Kolkata
Asia/Dubai
America/New_York

Never assume server timezone equals company timezone.

Shift calculations must use the shift/location/company timezone.

Payroll periods are date-based business concepts and should not be treated blindly as UTC timestamps.

Test:

* overnight shifts
* DST
* leap years
* month-end
* year-end
* different tenant timezones

---

# 67. MONEY

Never use floating point for salary calculations.

Use:

* integer minor units where suitable
  OR
* PostgreSQL numeric/decimal with explicit precision

Define currency.

All money should have:

amount
currency

Payroll rounding strategy must be explicit and configurable where needed.

---

# 68. IDEMPOTENCY

Financial and workflow APIs should use idempotency.

Examples:

* payroll processing
* payment webhook
* attendance sync
* employee bulk creation
* document generation

Avoid duplicate side effects caused by retries.

---

# 69. CONCURRENCY

Protect sensitive operations.

Examples:

Two payroll administrators cannot accidentally finalize the same payroll twice.

Use:

* transaction locking
* optimistic concurrency
* version columns
* idempotency
* durable workflows where suitable

---

# 70. OBSERVABILITY

Implement:

* structured logging
* request IDs
* traces where possible
* error monitoring abstraction
* metrics
* slow query monitoring
* queue failure monitoring

Create hooks for services such as:

* Sentry
* OpenTelemetry
* Cloudflare observability

Do not expose employee PII in telemetry.

---

# 71. FEATURE FLAGS

Feature entitlement and engineering feature flags are different.

Maintain separate concepts.

Subscription entitlement:

Does customer pay for Payroll?

Engineering feature flag:

Should new Payroll UI v2 appear for beta tenants?

Support tenant-targeted rollout.

---

# 72. CONFIGURATION

Avoid hardcoded policy behavior.

Create configuration systems for:

* attendance
* leave
* payroll
* approvals
* holidays
* recruitment stages
* document templates
* notifications
* employee numbering
* probation
* working week

Every configuration should have sane defaults.

Version/effective-date configurations when changes affect historical business results.

---

# 73. EMPLOYEE NUMBERING

Support configurable employee codes.

Example:

EMP-00001
HYD-00001
TECH-2026-00001

Generate server-side safely.

Prevent concurrency duplicates.

---

# 74. INTERNATIONALIZATION

Prepare architecture for:

* multiple languages
* multiple countries
* multiple currencies
* multiple timezones
* RTL languages later

Do not hardcode English text deep inside business logic.

Initial UI may be English.

---

# 75. ACCESSIBILITY

Use accessible:

* labels
* keyboard navigation
* contrast
* dialogs
* focus management
* errors
* tables
* screen-reader semantics

---

# 76. TESTING

This product requires serious automated testing.

Use:

Unit tests

for:

* payroll calculations
* attendance
* leave
* permissions
* feature entitlements
* formulas

Integration tests

for:

* database
* API
* tenant boundaries
* approval flows

E2E tests

using Playwright for critical web flows.

Mobile tests where practical.

Mandatory security test:

Create Tenant A and Tenant B.

Attempt every major API endpoint using Tenant A credentials against Tenant B IDs.

All attempts must fail.

---

# 77. PAYROLL TESTING

Payroll engine should use deterministic fixtures.

Test:

* joining mid-month
* leaving mid-month
* unpaid leave
* arrears
* bonus
* salary revision mid-cycle
* rounding
* tax calculations
* zero salary
* high salary
* overnight attendance input
* retroactive adjustment

Every calculation should be explainable.

Provide calculation breakdown.

---

# 78. ATTENDANCE TESTING

Test:

* normal shift
* night shift
* late entry
* early exit
* half day
* missing punch
* multiple punches
* wrong geofence
* weak GPS
* offline attendance
* timezone change
* daylight savings
* attendance regularization

---

# 79. PERFORMANCE

Avoid N+1 database queries.

Use proper indexes.

Paginate large lists.

Do not calculate giant reports synchronously in an HTTP request.

Queue large:

* exports
* payroll PDF generation
* large imports
* bulk notifications

Cache only where data correctness allows it.

Do not cache sensitive queries without tenant-aware keys.

---

# 80. DEVELOPMENT ENVIRONMENTS

Create:

local
development
staging
production

Separate resources.

Never use production database/R2 during automated tests.

Use environment validation at startup/deployment.

---

# 81. CI/CD

Create CI pipelines.

On pull request:

* install
* lint
* typecheck
* unit tests
* integration tests
* build

On protected deployment:

* migrations with safeguards
* deploy API
* deploy web
* smoke tests

Create deployment documentation.

---

# 82. LOCAL DEVELOPMENT

Provide one-command local development where possible.

Example:

pnpm dev

Should start relevant services/apps.

Provide:

.env.example

Never commit secrets.

Create realistic seed data.

---

# 83. DEMO DATA

Seed at least two tenants specifically to test isolation.

Example:

Tenant Alpha

* Alpha India Pvt Ltd
* Alpha UAE LLC
* ~30 employees

Tenant Beta

* Beta Technologies Pvt Ltd
* ~20 employees

Include:

* departments
* managers
* shifts
* attendance
* leave
* payroll sample structures
* recruitment
* timesheets

Never mix tenant records.

---

# 84. DATABASE ERD

Before implementing the full product, create an ERD/documented domain model.

Group tables by bounded context.

Potential contexts:

Platform
Identity
Tenant
Organization
Employees
Recruitment
Attendance
Leave
Timesheets
Payroll
Documents
Approvals
Notifications
Billing
Audit

Do not create one enormous unstructured schema file.

---

# 85. DOMAIN ARCHITECTURE

Follow modular monolith principles initially.

Do NOT start with dozens of microservices.

We want clean domain boundaries while keeping deployment/operations simple.

Separate domain modules logically.

Good:

modular monolith

* queues
* workflows
* separate worker boundaries only where needed

Bad:

40 microservices for an early-stage SaaS.

Architecture must allow future extraction of modules if scale requires it.

---

# 86. API / DOMAIN SEPARATION

HTTP handlers should be thin.

Bad:

route handler
→ 500 lines payroll logic

Good:

HTTP
→ validation
→ authorization
→ application service
→ domain service
→ repository
→ database

Business logic must be independently testable.

---

# 87. ERROR HANDLING

Create domain errors.

Examples:

TenantNotFound
Forbidden
FeatureNotEnabled
EmployeeNotFound
PayrollAlreadyLocked
AttendanceOutsideGeofence
LeaveBalanceInsufficient

Map these to standardized API responses.

Do not use arbitrary thrown strings.

---

# 88. BACKGROUND JOBS

Every background job must be:

* idempotent
* retry-safe
* observable
* tenant-aware

Use dead-letter handling where appropriate.

Examples:

email.send
document.generate
payroll.payslips.generate
employee.import
report.export
notification.push

---

# 89. DOCUMENT/PDF ARCHITECTURE

Implement document generation through a provider interface.

Example:

DocumentRenderer
renderHtmlToPdf()

Cloudflare implementation:

Cloudflare Browser Run

This allows future alternative providers.

Generated file:

HTML/template
→ snapshot data
→ render
→ PDF
→ R2
→ document metadata record

Do not regenerate historical legal documents dynamically every time a user opens them.

Store the generated artifact.

---

# 90. FORMULA ENGINE

Payroll/formula system must NOT use eval() on arbitrary customer JavaScript.

Build a safe expression engine.

Allow controlled operators/functions.

Example:

BASIC = CTC * 0.4

HRA = BASIC * 0.5

But execution must use a sandboxed parser/AST with allowed variables/functions.

Validate circular dependencies.

Display calculation explanations.

---

# 91. CUSTOM WORKFLOWS

Long-term architecture should allow tenant-configurable automation.

Example:

When employee joins
→ create onboarding tasks
→ notify manager
→ generate appointment letter

When resignation approved
→ initiate offboarding

Do not build a complete Zapier clone initially.

Provide domain events and reusable workflow architecture so this can evolve later.

---

# 92. DOMAIN EVENTS

Use domain events internally.

Examples:

EmployeeCreated
EmployeeJoined
LeaveSubmitted
LeaveApproved
AttendanceRecorded
CandidateHired
PayrollApproved
PayslipPublished

Events can trigger:

* notifications
* workflows
* webhooks
* audit

Do not make the primary transaction depend unnecessarily on slow external services.

---

# 93. PRIVACY

Collect only necessary employee data.

For location:

Do not implement permanent background employee surveillance as the default.

For attendance geolocation:

collect only according to company policy and user action/legitimate field-work requirements.

Create admin-facing privacy configuration/explanation.

---

# 94. DATA EXPORT / TENANT PORTABILITY

Tenant owner should eventually be able to export company information.

Architect export jobs for:

* employee master
* attendance
* leave
* payroll
* documents
* audit where permitted

This reduces vendor lock-in concerns for customers.

---

# 95. BACKUPS & DISASTER RECOVERY

Document:

* database backup policy
* R2 retention/version strategy where applicable
* restoration procedure
* RPO/RTO targets for future production

Do not claim backups exist unless configured and tested.

---

# 96. LEGAL / COMPLIANCE ARCHITECTURE

Prepare for:

* GDPR-style access/deletion workflows
* data residency considerations
* retention
* consent where required
* audit trails

Do not claim specific certifications such as SOC 2 or ISO 27001 unless actually achieved.

Design controls that can support those compliance efforts later.

---

# 97. MVP VS FULL PLATFORM

We ultimately want the complete platform above.

However, DO NOT attempt to generate the entire system as thousands of fake pages/stubs in one pass.

Implement production-quality vertical slices.

Maintain:

docs/IMPLEMENTATION_STATUS.md

For every module classify:

* Not Started
* Foundation
* In Progress
* Functional
* Production Ready

Never mark a module Production Ready without tests and completed core workflows.

---

# 98. IMPLEMENTATION PHASES

Use the following execution sequence.

PHASE 0 — Architecture/Foundation

Build:

* monorepo
* coding standards
* architecture docs
* Cloudflare infrastructure
* PostgreSQL
* migrations
* auth
* tenant resolution
* permissions
* audit foundation
* API standards
* design system
* CI
* testing

PHASE 1 — SaaS Platform

Build:

* Platform Admin
* tenant management
* company management
* plans
* entitlements
* subscription foundation
* tenant onboarding

PHASE 2 — Core HR

Build:

* organization structures
* employees
* employee profiles
* employee history
* documents
* custom fields
* manager hierarchy

PHASE 3 — Attendance

Build:

* shifts
* roster
* locations
* geofencing
* mobile attendance
* attendance calculation
* regularization

PHASE 4 — Leave

Build:

* leave policies
* leave ledger
* applications
* approvals
* holidays

PHASE 5 — Timesheets

Build:

* clients
* projects
* tasks
* time entries
* approvals
* reporting

PHASE 6 — Recruitment

Build:

* requisitions
* ATS
* interviews
* careers site
* offers
* candidate conversion

PHASE 7 — Documents & Onboarding

Build:

* templates
* PDFs
* letters
* policies
* onboarding workflows

PHASE 8 — Payroll

Build:

* compensation
* salary structures
* payroll engine
* payroll periods
* processing
* validation
* payslips
* taxation architecture
* country localization

PHASE 9 — Employee Operations

Build:

* expenses
* assets
* performance
* helpdesk
* announcements
* offboarding

PHASE 10 — Enterprise

Build:

* SSO
* SCIM
* API keys
* webhooks
* advanced audit
* custom reports
* custom workflows
* advanced feature flags

---

# 99. FIRST DEVELOPMENT MILESTONE

Do NOT start by building payroll UI.

Begin with the foundation.

First milestone must provide:

1. working monorepo
2. local development
3. PostgreSQL schema foundation
4. database migrations
5. seed data
6. authentication
7. tenant creation
8. company creation
9. tenant switching if authorized
10. RBAC
11. subscription/feature entitlement engine
12. core employee model
13. employee list
14. create/edit employee
15. Platform Admin tenant list
16. audit logging
17. Cloudflare Worker deployment
18. R2 integration
19. basic mobile app login
20. automated tenant-isolation tests

Once this milestone works end-to-end, proceed to subsequent phases.

---

# 100. UI PAGES FOR INITIAL FOUNDATION

Web:

Authentication

* Sign In
* Forgot Password
* Accept Invitation

Tenant Setup

* Create Organization
* Create Company
* Setup wizard

Main App

* Dashboard
* Employees
* Employee Profile
* Organization
* Departments
* Locations
* Settings

Platform Admin

* Dashboard
* Tenants
* Tenant Details
* Plans
* Feature Entitlements

Mobile

* Sign In
* Home
* Profile
* basic employee information

---

# 101. NAVIGATION ARCHITECTURE

Potential web navigation:

Home

People

* Employees
* Organization
* Documents

Time

* Attendance
* Shifts
* Leave
* Holidays
* Timesheets

Payroll

* Payroll Runs
* Salary
* Inputs
* Tax
* Payslips
* Reports

Hiring

* Jobs
* Candidates
* Interviews
* Offers

Performance

Expenses

Assets

Requests

Reports

Settings

Navigation items must respect:

* user permission
* tenant feature entitlement

But again:

server API must independently enforce both.

---

# 102. SETTINGS ARCHITECTURE

Settings areas:

Organization
Companies
Departments
Locations
Designations
Grades
Employment Types

Attendance
Shifts
Attendance Policies
Geofences

Leave
Leave Types
Policies
Holiday Calendars

Payroll
Pay Groups
Salary Components
Salary Structures
Tax
Payroll Calendar

Recruitment
Stages
Templates
Careers Site

Documents
Templates
Categories

Workflows
Approval Policies

Access
Users
Roles
Permissions

SaaS
Plan / Billing

Integrations

Developer
API keys
Webhooks

---

# 103. ARCHITECTURE DOCUMENTATION

Before or while building foundation, create:

docs/architecture/OVERVIEW.md

docs/architecture/MULTI_TENANCY.md

docs/architecture/AUTHORIZATION.md

docs/architecture/PAYROLL.md

docs/architecture/ATTENDANCE.md

docs/architecture/FILES.md

docs/architecture/WORKFLOWS.md

docs/architecture/SECURITY.md

docs/database/ERD.md

docs/product/MODULES.md

docs/product/IMPLEMENTATION_PLAN.md

docs/ADRs/

Use Architecture Decision Records for major decisions.

---

# 104. CLAUDE.md

Create a root CLAUDE.md containing rules for future Claude Code sessions.

Include:

* architecture principles
* directory conventions
* tenancy rules
* authorization requirements
* test requirements
* styling rules
* database migration requirements
* naming conventions
* forbidden shortcuts
* commands

Very important:

Any future Claude Code session must understand that no tenant-scoped query may bypass tenant isolation.

---

# 105. CODE QUALITY RULES

Use:

* TypeScript strict mode
* ESLint
* formatting
* no uncontrolled any
* explicit domain types
* small focused functions
* dependency boundaries

Avoid:

* god classes
* 1,000-line route handlers
* duplicate business logic
* magic strings
* giant shared utilities folder
* copy/pasted authorization
* frontend-only access control

---

# 106. PACKAGE BOUNDARIES

Suggested packages:

@hrms/database

Database schema/repositories.

@hrms/domain

Core domain concepts.

@hrms/auth

Authentication/session functionality.

@hrms/permissions

Authorization.

@hrms/entitlements

SaaS plans/features.

@hrms/payroll

Payroll engine.

@hrms/attendance

Attendance rules/calculation.

@hrms/validation

Shared schemas.

@hrms/api-client

Generated/typed client.

@hrms/ui

Web design system.

@hrms/design-tokens

Shared visual tokens.

@hrms/documents

Template/document engine.

Do not make packages depend on app code.

---

# 107. SECURITY GATES FOR PULL REQUESTS

Before major feature completion verify:

TENANCY:
Can another tenant access it?

AUTHORIZATION:
Does every mutation check permission?

ENTITLEMENT:
Does the API verify subscription access?

VALIDATION:
Are all inputs validated?

AUDIT:
Does sensitive mutation generate audit entry?

TESTING:
Are critical tests written?

PII:
Are we logging sensitive fields?

TIMEZONE:
Are date/time assumptions correct?

MONEY:
Are financial values precise?

---

# 108. DEFINITION OF DONE FOR A FEATURE

A module is not "done" because a UI exists.

Definition of Done:

* database model
* migrations
* domain logic
* API
* validation
* authorization
* tenant isolation
* feature entitlement if relevant
* audit events
* UI
* loading/error/empty states
* responsive behavior
* tests
* documentation
* seed/demo support
* production error handling

---

# 109. DEVELOPMENT BEHAVIOR FOR CLAUDE CODE

Follow these instructions carefully.

Do not just explain what should be done.

Actually inspect, create, edit and test the project.

At the beginning:

1. inspect current repository
2. identify existing files
3. do not destroy working code unnecessarily
4. create/update architecture documents
5. create implementation plan
6. begin implementation

If repository is empty:

initialize it correctly.

Do NOT ask unnecessary questions.

When product decisions are unspecified:

* choose a sensible production-grade default
* document it in docs/ASSUMPTIONS.md
* continue building

Only stop for input if an external credential or irreversible business decision genuinely blocks progress.

---

# 110. NEVER FAKE COMPLETION

Never say something is implemented if only:

* interface exists
* mock data exists
* placeholder API exists
* TODO exists
* button has no real action

Track true status.

Use TODO comments sparingly and include context.

---

# 111. TEST AFTER CHANGES

After logical implementation steps run appropriate:

* lint
* typecheck
* unit tests
* integration tests
* builds

Fix errors before continuing where practical.

Do not leave the repository knowingly broken.

---

# 112. DO NOT INSTALL RANDOM DEPENDENCIES

Before adding a package ask internally:

* Is it actively maintained?
* Does it work in Cloudflare Workers?
* Is there a native Web API alternative?
* Is it really needed?
* Does it significantly increase bundle size?
* Does it introduce security risk?

Prefer fewer high-quality dependencies.

---

# 113. CLOUDFLARE COMPATIBILITY

Remember backend runs in Cloudflare Workers.

Do not accidentally depend on unsupported Node APIs without verifying current Cloudflare compatibility.

Prefer Web APIs where suitable.

Use Cloudflare-supported Node compatibility only when needed.

Verify dependencies before adopting them.

---

# 114. PROVIDER ABSTRACTIONS

External providers must be behind interfaces.

Examples:

EmailProvider

StorageProvider

PdfProvider

PaymentProvider

SmsProvider

PushProvider

ESignProvider

IdentityProvider

This allows Cloudflare-first deployment today without locking the business layer permanently.

---

# 115. BUSINESS CONTINUITY

Critical financial operations must leave an explainable trail.

For payroll we must be able to answer:

Why did Employee X receive this amount?

For attendance:

Why was this day considered absent?

For leave:

Why is this employee's balance 8.5?

Create explainable calculation outputs.

---

# 116. EVENTUAL MOBILE CAPABILITIES

Mobile should ultimately support:

* check in/out
* GPS
* shift
* attendance
* leave
* regularization
* timesheet
* approvals
* profile
* documents
* payslips
* announcements
* onboarding
* expense claim
* notifications
* employee directory subject to permissions

Build mobile incrementally alongside backend modules.

---

# 117. ADMIN CONFIGURABILITY GOAL

The philosophy of this SaaS is:

Configure rather than customize source code.

A customer should not require us to deploy custom source code simply to modify:

* leave policy
* shift
* approval path
* salary components
* recruitment stages
* document templates
* company branding
* custom employee fields
* holiday calendar

Build configuration models accordingly.

---

# 118. SCALABILITY TARGET

Architect for:

small customer:
20 employees

medium:
1,000 employees

large:
50,000+ employees

Do not prematurely optimize every operation for millions of rows.

But avoid design decisions that fundamentally prevent scaling.

Use pagination, indexing, queues and asynchronous jobs from the start.

---

# 119. INITIAL CLOUD DEPLOYMENT

Create infrastructure documentation for Cloudflare.

Need instructions for:

* Workers
* custom domain
* R2
* Queues
* Workflows
* Hyperdrive
* Turnstile
* Browser Run/PDF
* secrets
* staging
* production

Database can initially use a managed PostgreSQL provider compatible with Hyperdrive.

Keep DATABASE_URL/provider details configurable.

Do not bake database-provider-specific APIs into domain logic.

---

# 120. FUTURE INFRASTRUCTURE MIGRATION

Document how the system could later migrate individual services.

Examples:

Cloudflare R2
→ S3

Cloudflare Workers
→ containers/Lambda/Kubernetes

Cloudflare Queues
→ SQS/Kafka

Cloudflare Workflows
→ Temporal / Step Functions

The system does NOT need to implement these alternatives now.

Simply maintain clear provider/domain boundaries.

---

# 121. PRODUCT QUALITY

This product should look and behave like something businesses would actually pay for.

Every important workflow should include:

* confirmation when destructive
* user-friendly validation
* meaningful errors
* auditability
* progress indication
* helpful empty state
* responsive design
* accessibility
* sensible defaults

Avoid overusing modal dialogs.

Use full-page flows for complex processes such as:

* payroll processing
* onboarding configuration
* salary structure configuration

---

# 122. IMPORTANT DATA MODEL DISTINCTIONS

Do not confuse:

User
≠ Employee

Tenant
≠ Company

Attendance Event
≠ Attendance Day Summary

Payroll Run
≠ Payslip

Candidate
≠ Employee

Salary Structure
≠ Employee Compensation

Leave Ledger
≠ Leave Request

Document Template
≠ Generated Document

Plan
≠ Feature Entitlement

Keep these concepts separate.

---

# 123. FIRST TASK — START NOW

Perform these steps now.

STEP 1

Inspect the repository.

STEP 2

Create:

docs/ASSUMPTIONS.md
docs/product/PRODUCT_REQUIREMENTS.md
docs/product/MODULES.md
docs/product/IMPLEMENTATION_PLAN.md
docs/architecture/OVERVIEW.md
docs/architecture/MULTI_TENANCY.md
docs/architecture/AUTHORIZATION.md
docs/architecture/SECURITY.md
docs/database/ERD.md
CLAUDE.md

STEP 3

Create a concrete repository structure and architectural diagram.

STEP 4

Create the foundational PostgreSQL data model including at minimum:

* users
* sessions/auth-related structures
* tenants
* tenant_memberships
* companies
* company_memberships/access
* roles
* permissions
* role_permissions
* member_roles
* plans
* features
* plan_entitlements
* tenant_entitlement_overrides
* departments
* locations
* designations
* employment_types
* employees
* employment_records
* audit_events

Adjust names if you have a stronger model.

STEP 5

Implement authentication.

STEP 6

Implement tenant context and tenant-isolation middleware.

STEP 7

Implement RBAC.

STEP 8

Implement subscription entitlement checking.

STEP 9

Build tenant/company onboarding.

STEP 10

Build employee CRUD as the first real vertical slice.

STEP 11

Build Platform Admin tenant management.

STEP 12

Create at least two seeded tenants and write cross-tenant access tests.

STEP 13

Set up Cloudflare deployment configuration.

STEP 14

Create the initial Expo mobile project and authenticated shell.

STEP 15

Run tests, typechecking and builds.

STEP 16

Update docs/product/IMPLEMENTATION_STATUS.md with what is actually working.

Then proceed with the implementation plan.

---

# FINAL ENGINEERING PRINCIPLE

At every implementation decision ask:

"Will this still work correctly when 5,000 unrelated companies use the same SaaS platform?"

And:

"Could a bug here expose one company's employees, payroll, documents or attendance to another company?"

If the second answer is potentially yes, redesign it before continuing.

Data isolation, financial correctness, auditability, security, configurability, user experience and maintainability are more important than quickly generating lots of screens.

Build this as a real SaaS product.
