# New Hire Intake Workflow (Slack + Google Sheets)

This runbook lets a Slack workspace admin create and publish a **no-code** intake workflow that writes onboarding data to Google Sheets through a Workflow Builder connector.

## 1) Create the workflow

1. In Slack desktop/web, open **Tools → Workflow Builder**.
2. Select **Create**.
3. Name it `New Hire Intake`.
4. Save the workflow in the destination workspace.

## 2) Configure the trigger

Use a link trigger so HR can run intake from a bookmark, pinned post, or onboarding channel topic.

1. Add trigger: **Link trigger**.
2. Trigger name: `Start New Hire Intake`.
3. Optional: Restrict who can run it (for example HR/admin group) if your workspace policy requires it.
4. Copy and store the generated trigger URL for HR operations documentation.

## 3) Add required pre-form message step (for channel-join triggers)

If you use `When a person joins a channel` as the trigger, Slack requires a message step with a **Continue Workflow** button before any interactive form step.

1. Add step: **Direct Message**.
2. Send to HR approvals (person or group).
3. Message example: `A new hire joined #new-hires. Click Continue Workflow to start onboarding intake.`
4. Save and confirm the message includes **Continue Workflow**.

## 4) Add the intake form step

Add a **Form** step after the message step with the fields below.

| Field label | Type | Required | Notes |
|---|---|---:|---|
| First name | Short text | Yes | Legal first name |
| Last name | Short text | Yes | Legal last name |
| Personal email | Email | Yes | Pre-start communication address |
| Work email | Email | No | Leave blank if not assigned yet |
| Job title | Short text | Yes | Offer title |
| Department | Short text | Yes | Department name |
| Manager email | Slack user (single) | No | Select manager from Slack directory |
| Start date | Date | Yes | YYYY-MM-DD from picker |
| Employment type | Dropdown | Yes | Full-time, Part-time, Contractor, Intern |
| Work location | Short text | Yes | Office, city/state, or Remote |
| Country | Short text | Yes | Payroll/legal country |
| Equipment needed | Long text | No | Laptop, accessories, special requests |
| Notes | Long text | No | HR-only context |

## 5) Map form outputs to spreadsheet onboarding schema

Add a **Google Sheets connector** step to append one row per submission.

1. Choose action: **Add row** (or equivalent append-row action).
2. Select target spreadsheet and worksheet.
3. Ensure worksheet headers exactly match this schema (left to right):

`submission_ts, slack_requester_id, slack_requester_email, first_name, last_name, personal_email, work_email, job_title, department, manager_email, start_date, employment_type, work_location, country, equipment_needed, notes, source_workflow, dedupe_key`

4. Map fields:

| Sheet column | Workflow value |
|---|---|
| submission_ts | Message timestamp or "Current time" token |
| slack_requester_id | User who ran workflow → User ID |
| slack_requester_email | User who ran workflow → Email |
| first_name | Form: First name |
| last_name | Form: Last name |
| personal_email | Form: Personal email |
| work_email | Form: Work email |
| job_title | Form: Job title |
| department | Form: Department |
| manager_email | Form: Manager email → selected user email token |
| start_date | Form: Start date |
| employment_type | Form: Employment type |
| work_location | Form: Work location |
| country | Form: Country |
| equipment_needed | Form: Equipment needed |
| notes | Form: Notes |
| source_workflow | Static text: `slack_new_hire_intake` |
| dedupe_key | Concatenate if available: requester + start_date + personal_email |

## 6) Authorize OAuth connectors

When adding Google Sheets actions, Slack will prompt for connector authorization.

1. Click **Connect account** for Google Sheets.
2. Sign in with the managed Google account that owns (or can edit) the onboarding sheet.
3. Grant requested permissions.
4. Confirm the selected sheet is writable by that account.

> Recommended: use a shared service account mailbox or team-owned Google identity so access persists through staffing changes.

## 7) Publish and test flow

1. Click **Publish** in Workflow Builder.
2. Run the link trigger once with test data.
3. Validate:
   - A new row appears in the onboarding sheet.
   - Values land in the correct columns.
   - Slack bot can post confirmation (if a message step was added).
4. Run a second test with a different candidate to confirm row appends without overwriting.

## 8) Duplicate-fire note (Google Apps Script dedupe behavior)

If the downstream Google Apps Script occasionally receives duplicate executions (for example from retries or accidental multi-submit), keep dedupe enabled:

- Use `dedupe_key` as the idempotency key.
- In GAS, check whether `dedupe_key` already exists before creating downstream artifacts.
- Store processed keys in `PropertiesService` (or cache + sheet lookup) with a short lock (`LockService`) during write operations.

This ensures duplicate triggers do not produce duplicate onboarding records.
