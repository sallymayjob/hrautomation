# HR Automation Responsibility Matrix (One Page)

**Documentation status:** Refreshed for Apps Script-native operations baseline (configuration, security, trigger reconciliation, and governed workflows). Canonical deployment/run sequence lives in `DEPLOYMENT.md`.


This matrix maps core workflow actions to the canonical spreadsheet of record and identifies which behaviors should live as shared utilities in the Apps Script library.

## Scope and naming baseline

- **Onboarding spreadsheet of record**: `ONBOARDING_SPREADSHEET_ID` / `ONBOARDING_SHEET_NAME` (tab name: `Onboarding`).
- **Audit spreadsheet of record**: `AUDIT_SHEET_NAME` (tab name: `Audit`) in the workbook resolved by `AUDIT_SPREADSHEET_ID` when configured, otherwise `TRAINING_SPREADSHEET_ID`.
- Naming in this doc follows existing schema/script identifiers to avoid drift.

## Responsibility matrix

| Workflow action | System responsibility (what happens) | Spreadsheet owner of record | Tab/identifier(s) in current repo | Shared utility in library? |
|---|---|---|---|---|
| New hire intake | Capture intake row, enforce required onboarding fields, initialize onboarding defaults. | **Onboarding spreadsheet** | `Onboarding` tab via `ONBOARDING_SHEET_NAME`; key fields include `EmployeeID`, `onboarding_id`, `employee_name`, `email`, `role`, `start_date`, `manager_email`, `status`. | **Yes** — shared header validation/default hydration helpers should remain reusable. |
| Account provisioning start | Resolve and persist account-linked identity fields used by onboarding flow (for example Slack IDs and onboarding state). | **Onboarding spreadsheet** | `Onboarding` tab fields `EmployeeID`, `slack_id`, `manager_slack_id`, `buddy_slack_id`, `status`, `blocked_reason`. | **Yes** — shared identity lookup + row update guardrails should be reusable. |
| Day-1 readiness | Track pre-start checks and readiness gates before onboarding is handed to training intake. | **Onboarding spreadsheet** | `Onboarding` + checklist readiness indicators (`status`, `checklist_completed`, `blocked_reason`) keyed by `EmployeeID`. | **Yes** — completion-gate evaluation should be reusable across triggers/commands. |
| Course assignment | Create/maintain required training assignments once onboarding handoff state is reached. | **Training spreadsheet** | `Training` tab via `TRAINING_SHEET_NAME`; keyed by `EmployeeID` and `training_id` with assignment metadata. | **Yes** — reusable assignment hydration/helpers should stay in shared library. |
| Completion tracking | Record training progress and determine training completion eligibility. | **Training spreadsheet** | `Training` status/percent complete fields keyed by `EmployeeID` and due-date attributes. | **Yes** — shared status transition validators and completion calculators are reusable. |
| Overdue reminders | Trigger reminder cadence for overdue training work. | **Training spreadsheet** | `Training` due/overdue reminder fields and reminder event history keyed by `EmployeeID`. | **Yes** — reminder scheduling/dedupe utilities should remain shared. |
| Manager escalation | Escalate unresolved or overdue training to manager/approvals channel. | **Training spreadsheet** | `Training` escalation and manager-routing fields (`manager_email`, approval/escalation markers) keyed by `EmployeeID`. | **Yes** — escalation routing logic and idempotent posting helpers should remain reusable. |
| Policy/compliance verification | Validate compliance controls after training completion and collect verification outcomes. | **Audit spreadsheet** | `Audit` tab via `AUDIT_SHEET_NAME`; compliance verification events keyed by `EmployeeID`. | **Yes** — structured policy-check event format should remain shared. |
| Evidence snapshots | Persist immutable evidence pointers/snapshots for completed checks. | **Audit spreadsheet** | `Audit` evidence-related records (`audit_id`, timestamps, details, hashes) keyed by `EmployeeID`. | **Yes** — shared audit append + hash/event-key generation should remain shared. |
| Unresolved exception reporting | Append immutable exception/error events for traceability and incident review. | **Audit spreadsheet** | `Audit` tab fields `audit_id`, `event_timestamp`, `actor_email`, `entity_type`, `entity_id`, `action`, `details`, `event_hash` keyed by `EmployeeID`. | **Yes** — structured audit logging/retry/error format should remain shared. |

## Cross-sheet handoff states (workflow map)

Use `EmployeeID` as the shared join key across `Onboarding`, `Training`, and `Audit` sheets.

| Handoff trigger state | Source spreadsheet | Destination spreadsheet | Required key/value contract | Operational meaning |
|---|---|---|---|---|
| `ONBOARDING_COMPLETE` | Onboarding | Training | `EmployeeID` present in source row + status value `ONBOARDING_COMPLETE` | Signals training intake should start (assignment + tracking ownership moves to Training sheet). |
| `TRAINING_COMPLETE` | Training | Audit | `EmployeeID` present in source row + status value `TRAINING_COMPLETE` | Signals employee is audit-eligible (policy/compliance verification ownership moves to Audit sheet). |

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
