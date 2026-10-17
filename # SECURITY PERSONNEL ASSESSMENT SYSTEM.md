# SECURITY PERSONNEL ASSESSMENT SYSTEM
## Project Specification

**Organization:** Global Ground Force Security Agency Inc.
**Location:** Legazpi City, Albay, Philippines
**Project Type:** Web-based Responsive Security Personnel Assessment and Monitoring System

---

# 1. PROJECT OVERVIEW

The Security Personnel Assessment System is a responsive web-based system designed to help Global Ground Force Security Agency Inc. manage and monitor security personnel records, attendance records, performance assessments, evaluation schedules, notifications, and reports.

The system is intended for assessment and monitoring purposes only.

The system must remain simple, maintainable, secure, and suitable for a BSIT thesis project.

---

# 2. PROJECT OBJECTIVES

The system aims to:

1. Centralize security personnel records.
2. Monitor employee attendance through DTR recording.
3. Record Time In and Time Out with timestamp, GPS, and live photo.
4. Track the required three evaluations within the employee's assessment period.
5. Allow supervisors to upload completed evaluation forms.
6. Allow HR to review evaluation forms and enter official assessment scores.
7. Automatically determine the corresponding rating from the approved score range.
8. Allow HR to provide assessment feedback.
9. Allow HR to make the official Passed or Not Passed decision.
10. Send SMS notifications for important system events.
11. Generate useful management reports.
12. Provide role-based access to protect confidential personnel information.
13. Maintain an audit trail for important system actions.

---

# 3. SYSTEM SCOPE

## Included

- User authentication
- Role-based access control
- Personnel management
- Supervisor management
- Post assignment
- Duty location assignment
- Duty shift assignment
- Employee start date at post
- DTR recording
- Time In
- Time Out
- Live photo capture
- GPS capture
- Timestamp
- Attendance summaries
- Assessment scheduling
- Three evaluation tracking
- Evaluation form upload
- Assessment scoring
- Rating calculation
- HR feedback
- Final Passed / Not Passed decision
- SMS notifications
- SMS logs
- Reports
- Analytics
- Top performer reporting
- Audit logs
- Responsive design

---

# 4. OUT OF SCOPE

The following must NOT be implemented unless explicitly requested later:

- Payroll
- Salary computation
- Recruitment
- Applicant tracking
- Deployment scheduling
- Automated personnel deployment
- Accounting
- Leave management
- Overtime management
- Attendance approval
- Attendance correction
- Incident reporting
- Automatic employment decisions
- Full HR management functionality

The DTR module is for recording and monitoring attendance only.

---

# 5. USER ROLES

The system has three primary roles.

## 5.1 HR / ADMIN

HR has the highest system authority.

HR can:

- Create employee accounts.
- Create supervisor accounts.
- Activate and deactivate accounts.
- View personnel records.
- Edit authorized personnel information.
- Assign supervisors.
- Assign posts.
- Assign duty locations.
- Assign duty shifts.
- Set employee start date at the assigned post.
- View all DTR records.
- View all assessments.
- Review uploaded evaluation forms.
- Enter official assessment scores.
- View calculated ratings.
- Provide official feedback.
- Return incomplete evaluation forms.
- Make final Passed / Not Passed decisions.
- View reports.
- View analytics.
- View SMS logs.
- View audit logs.

Only HR can:

- Enter official assessment scores.
- Finalize assessment results.
- Make the official Passed / Not Passed decision.

---

## 5.2 SUPERVISOR

Supervisors can only access personnel assigned to them.

Supervisors can:

- View assigned personnel.
- View assigned personnel profiles.
- View assigned personnel DTR.
- View assessment schedules.
- Upload completed evaluation forms.
- View submission status.
- View released assessment results.
- Receive evaluation reminders.
- View final decisions.

Supervisors cannot:

- View unrelated personnel.
- Enter official assessment scores.
- Change HR ratings.
- Change final decisions.
- Edit official DTR records.

---

## 5.3 EMPLOYEE / SECURITY PERSONNEL

Employees can only access their own records.

Employees can:

- Log in.
- Change temporary password on first login.
- View profile.
- View assigned post.
- View duty location.
- View duty shift.
- Record Time In.
- Record Time Out.
- Capture live attendance photo.
- Capture GPS coordinates.
- View personal DTR.
- View attendance summaries.
- View assessment schedules.
- View released assessment results.
- View HR feedback released to them.

Employees cannot:

- Edit official DTR records.
- Edit assessment scores.
- Edit ratings.
- Edit final decisions.
- View another employee's records.

---

# 6. TECHNOLOGY STACK

The preferred technology stack is:

## Frontend / Full-stack

Next.js with TypeScript.

## Styling

Tailwind CSS.

## Database

PostgreSQL through Supabase.

## Authentication

Supabase Authentication.

## File Storage

Supabase Storage.

Files may include:

- Evaluation forms
- Attendance photos
- Other authorized documents

## SMS

Use a Philippine-compatible SMS API such as Semaphore or another suitable provider.

The provider must be evaluated before implementation.

## Hosting

Vercel for the Next.js application.

## Version Control

GitHub.

## Development Environment

Cursor IDE.

---

# 7. ARCHITECTURE PRINCIPLES

The application should follow a clean and maintainable architecture.

Important principles:

1. Separate UI, business logic, and data access where practical.
2. Avoid unnecessary complexity.
3. Avoid duplicate logic.
4. Use reusable components.
5. Use consistent naming.
6. Validate user input.
7. Protect sensitive information.
8. Enforce role-based access.
9. Never rely only on frontend restrictions for security.
10. Perform authorization checks on the server/backend.
11. Do not expose sensitive database credentials.
12. Do not hardcode secrets or API keys.
13. Use environment variables for secrets.
14. Keep the system responsive.
15. Keep the system suitable for future maintenance.

---

# 8. CORE DATA RELATIONSHIPS

The primary relationship is:

Employee
→ Supervisor
→ Post
→ Duty Location
→ Duty Shift
→ Start Date
→ DTR
→ Assessment 1
→ Assessment 2
→ Assessment 3
→ Final Decision

Other important relationships include:

Employee
→ User Account

Supervisor
→ User Account

Assessment
→ Evaluation Form

Assessment
→ Score

Assessment
→ Rating

Assessment
→ Feedback

Assessment
→ SMS Notifications

User
→ Audit Logs

---

# 9. ASSESSMENT RULE

Each employee must undergo three evaluations within the applicable assessment period.

The exact evaluation schedule must be configurable.

Do not assume that evaluations must occur exactly every 30 days unless the agency confirms this rule.

Each assessment must have a status.

Possible statuses:

- Upcoming
- Due Soon
- Due
- Overdue
- Submitted
- Under Review
- Returned for Correction
- Completed

After the third evaluation is completed, HR may issue the final:

- PASSED
- NOT PASSED

The system must not independently make the official final employment decision.

---

# 10. ASSESSMENT RATING

HR enters the official assessment score.

The system calculates the corresponding rating based on configured score ranges.

Possible ratings:

- Outstanding
- Very Satisfactory
- Satisfactory
- Needs Improvement
- Unsatisfactory

Score ranges must be configurable.

Do not invent official score ranges without confirmation from the organization.

---

# 11. DTR RULES

The DTR module records attendance.

Time In and Time Out should record:

- Employee
- Date
- Time
- GPS coordinates
- Attendance photo
- Verification status

The system should calculate:

- Late arrivals
- Absence summaries
- Missing Time In
- Missing Time Out
- Attendance totals

The system must not implement:

- Attendance approval
- Attendance correction
- Leave processing
- Overtime approval
- Payroll calculation

---

# 12. SMS RULES

SMS notifications may include:

1. Initial account/setup notification.
2. Supervisor assessment reminder.
3. HR evaluation submission notification.
4. Assessment result notification.
5. Final decision notification.
6. Important overdue assessment notifications.

Every SMS must have a log.

Recommended log information:

- Recipient
- Employee
- Message type
- Related record
- Date/time
- Delivery status
- Provider response where available

Do not hardcode SMS credentials.

---

# 13. SECURITY REQUIREMENTS

The system handles sensitive information.

Security requirements include:

- Role-based access control.
- Server-side authorization.
- Secure authentication.
- Password protection.
- Session management.
- Protected file access.
- Input validation.
- File type validation.
- File size validation.
- Audit logging.
- Environment variables for secrets.
- Database access restrictions.
- Secure API handling.

Employees must never be able to access other employees' data.

Supervisors must never be able to access personnel outside their assignment.

---

# 14. AUDIT LOGGING

Important actions should be logged.

Examples:

- Account creation
- Account activation
- Account deactivation
- Personnel assignment
- Assessment submission
- Assessment return
- Score entry
- Feedback entry
- Final decision
- Important profile changes
- SMS events

Audit records should identify:

- User
- Action
- Related record
- Date/time
- Relevant change information where appropriate

---

# 15. UI/UX PRINCIPLES

The interface should be:

- Clean
- Professional
- Responsive
- Simple
- Easy to navigate
- Appropriate for an internal security agency system

Use consistent:

- Typography
- Spacing
- Buttons
- Forms
- Tables
- Status badges
- Modals
- Alerts
- Navigation

The interface must work on:

- Desktop
- Laptop
- Tablet
- Mobile browser

Avoid unnecessary animations and decorative features.

Prioritize usability.

---

# 16. DEVELOPMENT RULES FOR CURSOR

When working on the project:

1. Work only on the requested phase.
2. Do not implement future phases unless explicitly requested.
3. Do not modify unrelated modules.
4. Do not remove existing working features.
5. Do not change the database structure unnecessarily.
6. Reuse existing components.
7. Check existing code before creating new components.
8. Follow existing naming conventions.
9. Preserve existing functionality.
10. Explain important architectural changes before making large changes.
11. Never expose secrets.
12. Never hardcode credentials.
13. Keep changes focused.
14. Test the affected functionality before considering the task complete.
15. Report any assumptions clearly.

---

# 17. CODE QUALITY PRINCIPLES

Prefer:

- Simple solutions
- Reusable components
- Clear naming
- Small functions
- Type safety
- Consistent validation
- Clear error handling
- Maintainable code

Avoid:

- Overengineering
- Unnecessary libraries
- Duplicate components
- Duplicate business logic
- Unnecessary abstractions
- Features outside the current phase

---

# 18. MVP PRIORITY

The minimum viable system should contain:

1. Authentication
2. Role-based access
3. Personnel management
4. Supervisor assignment
5. Post/location/shift assignment
6. Employee dashboard
7. DTR recording
8. Assessment tracking
9. Evaluation form upload
10. HR scoring
11. Rating calculation
12. Final decision
13. Basic SMS notifications
14. Basic reports

Advanced analytics and enhancements should come later.

---

# 19. IMPORTANT PROJECT RULE

This is a BSIT thesis project.

The system should prioritize:

- Feasibility
- Reliability
- Security
- Simplicity
- Maintainability
- Defensibility during thesis presentation

Do not add features simply because they are technically possible.

Every feature should have a clear connection to the project's objectives.

---

# 20. CURRENT DEVELOPMENT STATUS

Development must follow the phases defined in:

DEVELOPMENT_PHASES.md

Only work on the currently requested phase.

Before implementing a phase:

1. Inspect the existing project.
2. Identify what has already been completed.
3. Confirm dependencies.
4. Implement only the requested scope.
5. Test the changes.
6. Report completed work.
7. Report remaining issues.

Do not proceed automatically to the next phase.