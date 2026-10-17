# SECURITY PERSONNEL ASSESSMENT SYSTEM
## Development Phases

This document divides the project into manageable development phases.

IMPORTANT:

- Complete only one phase at a time.
- Do not implement future phases unless explicitly requested.
- Test each phase before proceeding.
- Do not rewrite working modules unnecessarily.
- Preserve existing functionality.
- Keep each Cursor task focused to reduce context and token usage.

---

# PHASE 1 — PROJECT FOUNDATION

## Objective

Create the basic application foundation.

## Scope

Implement:

- Next.js project structure
- TypeScript
- Tailwind CSS
- Supabase connection
- Environment variable structure
- Basic application layout
- Basic navigation
- Authentication foundation
- Login page
- Logout
- Protected routes/pages
- Basic role structure

## Roles

- HR
- Supervisor
- Employee

## Dashboard placeholders

Create basic dashboard pages for:

- HR
- Supervisor
- Employee

These dashboards do not need complete features yet.

## Do NOT implement

- DTR
- Assessment
- SMS
- Reports
- Analytics
- File upload

## Completion Criteria

The following must work:

- Application starts successfully.
- Database connection works.
- User can log in.
- User can log out.
- Unauthorized users cannot access protected pages.
- Users are routed to the correct dashboard according to role.

---

# PHASE 2 — PERSONNEL AND USER MANAGEMENT

## Objective

Create the personnel and assignment management foundation.

## HR Features

Implement:

- Employee list
- Employee creation
- Employee profile
- Employee editing
- Account activation/deactivation
- Supervisor management
- Supervisor assignment
- Post management
- Duty location management
- Duty shift management
- Employee post assignment
- Employee start date at post

## Supervisor Features

Supervisor can:

- View assigned employees
- View employee basic information
- View assignment information

## Employee Features

Employee can:

- View own basic profile
- View assigned post
- View duty location
- View duty shift

## Do NOT implement

- DTR
- Assessment scoring
- SMS
- Reports

## Completion Criteria

HR should be able to create an employee and assign:

Employee
→ Supervisor
→ Post
→ Duty Location
→ Duty Shift
→ Start Date

Supervisor should only see assigned employees.

Employee should only see their own information.

---

# PHASE 3 — EMPLOYEE DASHBOARD AND PROFILE

## Objective

Complete the employee-facing dashboard.

## Features

Implement:

- Employee dashboard
- Profile page
- Assigned post display
- Duty location display
- Duty shift display
- Start date display
- Assessment status placeholder
- DTR summary placeholder
- Password change
- Account settings

## Security

Employee must only access their own information.

## Do NOT implement

- Actual Time In
- Actual Time Out
- Assessment processing
- SMS

## Completion Criteria

Employee can log in and clearly see their own account and assignment information.

---

# PHASE 4 — DTR AND ATTENDANCE

## Objective

Implement attendance recording and monitoring.

## Employee

Implement:

### Time In

Capture:

- Employee ID
- Date
- Time
- GPS
- Live photo
- Verification status

### Time Out

Capture the same required information.

## DTR History

Employee can view:

- Date
- Time In
- Time Out
- Location
- Verification status

## HR

HR can view:

- All DTR records
- Daily summary
- Weekly summary
- Monthly summary
- Late summary
- Absence summary
- Missing Time In
- Missing Time Out

## Supervisor

Supervisor can view DTR of assigned personnel only.

## Important

Do not implement:

- Attendance correction
- Attendance approval
- Leave
- Overtime
- Payroll

## Completion Criteria

A valid Time In and Time Out record can be created and displayed correctly.

---

# PHASE 5 — ASSESSMENT SCHEDULING AND TRACKING

## Objective

Implement the three-evaluation workflow.

## Assessment Structure

Each employee has:

- Evaluation 1
- Evaluation 2
- Evaluation 3

The system calculates due dates based on the employee's start date and configurable agency rules.

## Assessment statuses

Implement:

- Upcoming
- Due Soon
- Due
- Overdue
- Submitted
- Under Review
- Returned for Correction
- Completed

## HR Dashboard

Display:

- Upcoming evaluations
- Due evaluations
- Overdue evaluations
- Completed evaluations

## Supervisor Dashboard

Display:

- Assigned employees
- Evaluation schedule
- Evaluation status
- Upcoming evaluations
- Overdue evaluations

## Employee Dashboard

Display:

- Own assessment schedule
- Assessment status
- Released results

## Do NOT implement yet

- Final decision
- SMS
- Advanced analytics

## Completion Criteria

The system correctly tracks an employee from:

Start Date
→ Evaluation 1
→ Evaluation 2
→ Evaluation 3

---

# PHASE 6 — EVALUATION FORMS, SCORING, AND FINAL DECISION

## Objective

Implement the complete assessment process.

## Supervisor

Implement:

- Evaluation form upload
- PDF support
- Word document support
- Image support
- Submission status
- Resubmission after correction

## HR

Implement:

- Review uploaded form
- Approve/review submission
- Return for correction
- Enter official score
- Calculate rating
- Add feedback
- Complete evaluation

## Rating

Use configurable rating ranges.

Possible levels:

- Outstanding
- Very Satisfactory
- Satisfactory
- Needs Improvement
- Unsatisfactory

Do not invent final score ranges without approved business rules.

## Final Decision

After the third evaluation:

HR can issue:

- PASSED
- NOT PASSED

Only HR can issue the final decision.

## Employee

Employee can view:

- Assessment score
- Rating
- Feedback
- Final decision when released

## Completion Criteria

Complete workflow:

Supervisor
→ Uploads form
→ HR reviews
→ HR enters score
→ System calculates rating
→ HR provides feedback
→ Result released
→ Evaluation completed

After Evaluation 3:

HR
→ Final Decision
→ Passed / Not Passed

---

# PHASE 7 — SMS INTEGRATION

## Objective

Implement automated SMS notifications.

## Required Notifications

### Employee

- Initial account/setup notification
- Assessment result
- Final decision

### Supervisor

- Evaluation reminder
- Assessment result
- Final decision

### HR

- Evaluation submission notification
- Important SMS failure notification

## SMS Logs

Store:

- Recipient
- Employee
- Notification type
- Related record
- Date/time
- Delivery status
- Provider response if available

## Important

Do not hardcode:

- API keys
- API secrets
- Provider credentials

Use environment variables.

## Duplicate Prevention

The system should avoid sending duplicate notifications for the same trigger.

## Completion Criteria

SMS can be triggered by the appropriate events and every notification is logged.

---

# PHASE 8 — REPORTS AND ANALYTICS

## Objective

Create management reports.

## HR Dashboard

Display:

- Total employees
- Active employees
- Upcoming assessments
- Overdue assessments
- Completed assessments
- Passed
- Not Passed
- Late personnel
- Absence summaries

## Reports

Implement:

- Personnel report
- DTR report
- Assessment report
- Passed/Not Passed report
- Overdue assessment report
- Supervisor performance report
- SMS notification report

## Filters

Reports should support appropriate filters:

- Date range
- Employee
- Supervisor
- Post
- Duty location
- Shift
- Assessment status
- Rating

## Top Performers

Create a configurable ranking system combining:

- Assessment performance
- Attendance performance

The formula must be approved before implementation.

## Export

Support:

- Print
- PDF
- CSV/Excel where practical

## Completion Criteria

HR can generate useful management reports from actual system data.

---

# PHASE 9 — SECURITY, AUDIT, AND SYSTEM HARDENING

## Objective

Improve system security after all major features are working.

## Access Control

Verify:

- HR can access all authorized records.
- Supervisor can access only assigned personnel.
- Employee can access only own records.
- Supervisor cannot modify HR scores.
- Employee cannot modify official DTR.
- Employee cannot modify assessment results.
- Unauthorized users cannot access protected resources.

## Audit Logs

Track important actions:

- User creation
- Account changes
- Personnel assignment
- Evaluation submission
- Evaluation return
- Score entry
- Feedback
- Final decision
- Important profile changes

## File Security

Validate:

- File type
- File size
- Upload permissions
- File access permissions

## Authentication Security

Review:

- Password security
- Session management
- Password reset
- First-login password change

## API Security

Check:

- Environment variables
- Server-side authorization
- Database permissions
- Sensitive information exposure

## Completion Criteria

Conduct an authorization and security review before deployment.

---

# PHASE 10 — TESTING, OPTIMIZATION, AND DEPLOYMENT

## Objective

Prepare the application for actual demonstration and deployment.

## Functional Testing

Test:

### HR

- Login
- Personnel
- Assignments
- DTR
- Assessments
- Scoring
- Final decision
- Reports
- SMS logs

### Supervisor

- Login
- Assigned personnel
- DTR
- Evaluation upload
- Assessment status
- Results

### Employee

- Login
- Password change
- Time In
- Time Out
- DTR
- Assessment
- Results

## Edge Cases

Test:

- GPS denied
- Camera denied
- Invalid file
- Oversized file
- Missing Time In
- Missing Time Out
- Duplicate Time In
- Duplicate Time Out
- Overdue assessment
- Returned evaluation
- Failed SMS
- Unauthorized URL access
- Deactivated account

## Responsive Testing

Test:

- Desktop
- Laptop
- Tablet
- Mobile

## Performance

Review:

- Slow pages
- Large tables
- Large file uploads
- Database queries
- Dashboard loading

## Deployment

Prepare:

- Production environment variables
- Supabase production configuration
- Storage configuration
- SMS configuration
- Vercel deployment
- Domain configuration if applicable
- Database backup strategy

## Documentation

Prepare:

- System documentation
- User guide
- Admin guide
- Deployment guide
- Thesis screenshots
- Test results

## Completion Criteria

The system is ready for:

- Demonstration
- User acceptance testing
- Thesis presentation
- Production-like deployment

---

# DEVELOPMENT RULE

Never ask Cursor to implement all ten phases at once.

Recommended workflow:

PHASE 1
→ Test
→ Fix
→ Commit

PHASE 2
→ Test
→ Fix
→ Commit

PHASE 3
→ Test
→ Fix
→ Commit

Continue until:

PHASE 10
→ Final Testing
→ Deployment

Each phase should be treated as an independent milestone.

---

# CURSOR TASK FORMAT

For every development request, use this structure:

## Current Phase

[Phase number and name]

## Goal

[One specific objective]

## Existing Features

[List only relevant features that already work]

## Task

[Exactly what Cursor should implement]

## Constraints

- Do not modify unrelated features.
- Do not implement future phases.
- Do not remove existing functionality.
- Follow PROJECT_SPECIFICATION.md.
- Reuse existing components where possible.
- Keep the implementation simple.

## Acceptance Criteria

[List exactly how the feature will be tested]

## Expected Output

After completing the task, report:

1. What was changed.
2. What files/modules were affected.
3. What was tested.
4. Any issues or assumptions.
5. Any recommended next step.

Do not automatically proceed to the next phase.