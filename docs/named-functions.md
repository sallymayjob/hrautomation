# Named Functions Reference

This document defines the canonical Google Sheets named functions used by HR Automation templates.

## `SYS_MAKE_ID(prefix, dt, seq, trigger)`

Generates a deterministic ID for sheet-managed entities.

- **Arguments**
  - `prefix` (text): Entity prefix such as `ONB`, `AUD`, `TRN`, `TSK`.
  - `dt` (date/datetime): Source date used in the ID timestamp segment.
  - `seq` (number): Sequence number (for example row number or per-day sequence).
  - `trigger` (text): Source label such as `SLACK`, `MANUAL`, `SCRIPT`.
- **Returns**: text ID in canonical pattern: `<prefix>_<yyyymmddThhmmssZ>_<seq4>_<trigger>`.
- **Example**: `=SYS_MAKE_ID("ONB", A2, ROW()-1, "SLACK")`
- **Usage**: Formula-driven IDs in sheets. Scripts must treat populated IDs as immutable.

## `SYS_IS_COMPLETE(required_count, completed_count)`

Computes completion state from required and completed totals.

- **Arguments**
  - `required_count` (number): Number of required tasks/items.
  - `completed_count` (number): Number of completed required tasks/items.
- **Returns**: boolean (`TRUE` when `completed_count >= required_count`, otherwise `FALSE`).
- **Example**: `=SYS_IS_COMPLETE(N2, O2)`
- **Usage**: Formula-driven completion fields (for example onboarding/checklist completion flags).

## `SYS_EVENT_KEY(entity_id, event_type, event_ts)`

Builds a unique event key for dedupe and audit correlation.

- **Arguments**
  - `entity_id` (text): ID of the onboarding/training/audit entity.
  - `event_type` (text): Event class such as `CREATE`, `UPDATE`, `STATUS_CHANGE`.
  - `event_ts` (date/datetime): Event timestamp.
- **Returns**: text key (stable, deterministic) suitable for dedupe/event hash input.
- **Example**: `=SYS_EVENT_KEY(A2, F2, B2)`
- **Usage**: Formula-driven event key/hash source columns; scripts should consume but not recompute when present.

## Ownership Rules

- Workflow mappings should populate **raw input columns only**.
- Named functions should populate **ID and derived columns**.
- Apps Script should only backfill derived values when columns are empty.
