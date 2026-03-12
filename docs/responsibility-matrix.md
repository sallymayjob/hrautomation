# HR Automation Responsibility Matrix (One Page)

This matrix maps core workflow actions to the canonical spreadsheet of record and identifies which behaviors should live as shared utilities in the Apps Script library.

## Scope and naming baseline

- **Onboarding spreadsheet of record**: `ONBOARDING_SPREADSHEET_ID` / `ONBOARDING_SHEET_NAME` (tab name: `Onboarding`).
- **Audit spreadsheet of record**: `AUDIT_SPREADSHEET_ID` / `AUDIT_SHEET_NAME` (tab name: `Audit`).
- Naming in this doc follows existing schema/script identifiers to avoid drift.

## Responsibility matrix

| Workflow action | System responsibility (what happens) | Spreadsheet owner of record | Tab/identifier(s) in current repo | Shared utility in library? |
|---|---|---|---|---|
| New hire intake | Capture intake row, enforce required onboarding fields, initialize onboarding defaults. | **Onboarding spreadsheet** | `Onboarding` tab via `ONBOARDING_SHEET_NAME`; fields include `onboarding_id`, `employee_name`, `email`, `role`, `start_date`, `manager_email`, `status`. | **Yes** — shared header validation/default hydration helpers should remain reusable. |
| Account creation | Resolve and persist account-linked identity fields used by onboarding flow (for example Slack IDs and onboarding state). | **Onboarding spreadsheet** | `Onboarding` tab fields `slack_id`, `manager_slack_id`, `buddy_slack_id`, `status`, `blocked_reason`. | **Yes** — shared identity lookup + row update guardrails should be reusable. |
| Probation checks | Compute date-based due windows from onboarding start and role mapping probation rules. | **Onboarding spreadsheet** | Probation logic originates from `start_date` and role mapping (`probationDays`) during onboarding processing. | **Yes** — date window calculation should be centralized as a utility. |
| Completion checks | Evaluate whether onboarding can transition to complete based on checklist/required conditions. | **Onboarding spreadsheet** | `Onboarding` status fields and completion gate signals (`status`, `checklist_completed`, `blocked_reason`). | **Yes** — completion-gate evaluation should be reusable across triggers/commands. |
| Exception reporting | Append immutable exception/error events for traceability and incident review. | **Audit spreadsheet** | `Audit` tab via `AUDIT_SHEET_NAME`; fields `audit_id`, `event_timestamp`, `actor_email`, `entity_type`, `entity_id`, `action`, `details`, `event_hash`. | **Yes** — structured audit logging/retry/error format should remain shared. |

## Single source of truth field list

Use these canonical identifiers when writing automation logic, docs, and formulas:

| Business label | Canonical identifier in repo | Source of truth sheet/tab | Notes to prevent naming drift |
|---|---|---|---|
| Employee ID | `onboarding_id` (primary onboarding key; backward-compatible alias `EMPLOYEE_ID` in `COL.ONBOARDING`, and `employee_id` used in training rows) | `Onboarding` | Prefer `onboarding_id` for onboarding lifecycle joins. |
| Start Date | `start_date` | `Onboarding` | Use exact snake_case identifier from onboarding schema. |
| Manager Email | `manager_email` | `Onboarding` | Required workflow field; used in assignment and reminder routing. |
| Status | `status` | `Onboarding` | Canonical onboarding state field (`PENDING`, `IN_PROGRESS`, `BLOCKED`, `COMPLETE`). |

## Implementation note for maintainers

When adding/adjusting any action above, update both schema-aware code paths and script-property mapped sheet/tab names together (`ONBOARDING_SHEET_NAME`, `AUDIT_SHEET_NAME`) so ownership boundaries stay explicit.
