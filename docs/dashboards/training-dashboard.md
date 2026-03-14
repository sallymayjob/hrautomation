# Training Dashboard Spec

**Documentation status:** Refreshed for Apps Script-native operations baseline (configuration, security, trigger reconciliation, and governed workflows). Canonical deployment/run sequence lives in `DEPLOYMENT.md`.


## Spreadsheet Ownership
- **Owning spreadsheet**: `TRAINING_SPREADSHEET_ID`.
- **Data source policy**: This dashboard reads local tabs in the training workbook only (`Training` and dashboard tabs in this workbook).
- **Cross-workbook rule**: Do not reference other workbooks implicitly. If external data is needed, use explicit `IMPORTRANGE("<spreadsheet_id>", "<tab>!<range>")` on a dedicated staging tab.

## Required Tabs
- `Training_Dashboard`
- `Training_KPI`
- `Training_Pivot`

## KPI Cards
1. `assigned_training_count`: total assigned modules.
2. `completed_training_count`: rows where `training_status` is `Completed`.
3. `in_progress_training_count`: rows where `training_status` is `In Progress`.
4. `overdue_training_count`: rows where `training_status` is `Overdue`.
5. `on_time_completion_rate`: completed on/before due date / all completed modules.

## Pivot Dimensions
- `module_code`
- `module_name`
- `training_status`
- `owner_email`
- `assigned_month`

## Named Ranges and Named Functions for Charts

### Named ranges
- `TRN_SOURCE_ROWS` -> `Training!A:M`
- `TRN_KPI_TABLE` -> `Training_KPI!A:F`
- `TRN_PIVOT_TABLE` -> `Training_Pivot!A:F`

### Named functions
- `SYS_EVENT_KEY(entity_id, event_type, event_ts)` for stable timeline keys on assignment/completion activity charts.
