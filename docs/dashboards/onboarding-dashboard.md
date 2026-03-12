# Onboarding Dashboard Spec

## Spreadsheet Ownership
- **Owning spreadsheet**: `ONBOARDING_SPREADSHEET_ID`.
- **Data source policy**: This dashboard reads local tabs in the onboarding workbook only (`Onboarding`, `Checklist`, and dashboard tabs in this workbook).
- **Cross-workbook rule**: Do not reference tabs in other workbooks directly. If external data is ever required, use explicit `IMPORTRANGE("<spreadsheet_id>", "<tab>!<range>")` formulas on a staging tab.

## Required Tabs
- `Onboarding_Dashboard`
- `Onboarding_KPI`
- `Onboarding_Pivot`

## KPI Cards
1. `active_onboarding_count`: count of onboarding rows where `status` is `PENDING`, `IN_PROGRESS`, or `BLOCKED`.
2. `completed_onboarding_count`: count where `status` is `COMPLETE`.
3. `blocked_onboarding_count`: count where `status` is `BLOCKED`.
4. `checklist_completion_rate`: completed required checklist tasks / total required checklist tasks.
5. `overdue_task_count`: checklist tasks with due date before `TODAY()` and status not complete.

## Pivot Dimensions
- `brand`
- `region`
- `role`
- `manager_email`
- `status`

## Named Ranges and Named Functions for Charts

### Named ranges
- `ONB_SOURCE_ROWS` -> `Onboarding!A:P`
- `ONB_CHECKLIST_ROWS` -> `Checklist!A:S`
- `ONB_KPI_TABLE` -> `Onboarding_KPI!A:F`
- `ONB_PIVOT_TABLE` -> `Onboarding_Pivot!A:F`

### Named functions
- `SYS_IS_COMPLETE(required_count, completed_count)` for completion state rollups.
- `SYS_EVENT_KEY(entity_id, event_type, event_ts)` for deterministic event-series grouping when plotting onboarding state transitions.
