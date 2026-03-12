# Architecture Dataflow and Failure Behavior

This document explains how data moves between sheets, who owns each part of that data, and what the automation does when something is wrong.

## System dataflow

```text
Slack onboarding workflow
        |
        v
[Onboarding sheet] --(derive tasks by onboarding_id)--> [Checklist Tasks sheet]
        |                                                   |
        |                                                   +-- operational status updates (human + automation)
        |
        +--(derive training assignments by employee/onboarding id)--> [Training sheet]
        |
        +--(all state changes/events)-------------------------------> [Audit sheet]
```

## Sheet roles, ownership, and connection model

| Sheet | Role in architecture | Primary key / join key | Typical writers | Failure impact |
|---|---|---|---|---|
| Onboarding (source) | Source-of-truth intake row for each new hire. | `onboarding_id` | Slack workflow (human-entered fields), Apps Script (enrichment fields) | Downstream checklist/training generation stops or becomes incomplete. |
| Checklist Tasks (derived operational) | Per-team operational tasks derived from onboarding records. | `task_id` and `onboarding_id` | Apps Script template generation; human teams update task status/notes in Sheets | Task reminders and progress checks become unreliable. |
| Audit (event log) | Append-oriented trace of state transitions and system actions. | `audit_id`, plus `entity_id` | Apps Script only | Incident analysis and compliance traceability are degraded. |
| Training (training/reminder) | Assignment and reminder state for modules per employee. | `employee_id` (or onboarding-linked employee identity) + `module_code` | Apps Script for assignment/status computation; humans may fill completion dates | Reminder cadence and completion celebrations break or duplicate. |

## Write rules and safety boundaries

### 1) Human-editable vs automation-managed columns

Treat columns as immutable contracts aligned to sheet schema definitions:

- **Onboarding**
  - Human/workflow-editable: `employee_name`, `email`, `role`, `brand`, `start_date`, `region`, `manager_email`, `buddy_email`, `dob`.
  - Automation-managed: `onboarding_id`, `slack_id`, `manager_slack_id`, `buddy_slack_id`, `status`, `dm_sent_at`, `checklist_completed`, `row_hash`, `blocked_reason`.
- **Checklist Tasks**
  - Human-editable: `status`, `due_date`, `updated_by`, `notes`.
  - Automation-managed: `task_id`, `onboarding_id`, `phase`, `task_name`, `owner_team`, `owner_slack_channel`, `updated_at`.
- **Audit**
  - Automation-managed only: all columns (`audit_id`, `event_timestamp`, `actor_email`, `entity_type`, `entity_id`, `action`, `details`).
- **Training**
  - Human/workflow-editable: `completion_date`.
  - Automation-managed: `employee_id`, `module_code`, `module_name`, `assigned_date`, `due_date`, `training_status`.

If a process needs to change ownership of a column, update the schema JSON first, then roll out code and operator guidance together.

### 2) Idempotency keys

To prevent duplicate writes, operations should key writes by stable identifiers:

- Onboarding ingestion and enrichment: `onboarding_id`.
- Checklist generation: deterministic `task_id` per (`onboarding_id`, template task).
- Training assignment: unique pair (`employee_id`, `module_code`) per assignment lifecycle.
- Audit append: generated `audit_id`; do not mutate existing audit rows.

When retries happen (trigger rerun, script timeout, manual rerun), use these keys for upsert/skip logic so the same business event is recorded once.

### 3) Schema validation and fail-closed behavior

All sheet reads/writes must validate expected headers and required columns before processing:

1. Load expected schema version + required headers.
2. Compare against live tab headers.
3. **If mismatch exists, fail closed**:
   - Stop processing the current workflow step.
   - Do not write partial downstream data.
   - Emit an audit/error signal with context.
   - Require explicit operator fix (headers/tab/schema alignment) before resume.

Fail-closed is intentional: incomplete writes are harder to recover than blocked writes.

## Troubleshooting

### Mismatched IDs between sheets

Symptoms:
- Checklist rows exist with unknown `onboarding_id`.
- Training rows reference an employee identity that cannot be mapped back to onboarding.

Checks:
1. Confirm source onboarding row still exists and `onboarding_id` has not been manually edited.
2. Verify derived rows were generated from the current template/version.
3. Re-run the derivation job only after fixing source IDs; avoid hand-editing derived keys.

### Missing tabs (sheet name mismatch)

Symptoms:
- Runtime errors indicating tab not found.
- Daily reminders stop across one or more flows.

Checks:
1. Verify script properties for `*_SHEET_NAME` match actual tab names exactly.
2. Confirm tabs required by schemas exist in the target spreadsheets.
3. Restore missing tabs from template CSV/schema and rerun.

### Schema drift (header added/renamed/reordered manually)

Symptoms:
- Validation failures on required headers.
- Writes shifted into wrong columns.

Checks:
1. Compare live headers to schema JSON `requiredHeaders` and `columns`.
2. Revert manual header changes or update schema + code in the same release.
3. Resume automation only after validation passes in all affected tabs.

## Related docs

- [README](../README.md)
- [Deployment guide](../DEPLOYMENT.md)
- [Runbook](./runbook.md)
