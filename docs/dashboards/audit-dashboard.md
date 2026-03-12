# Audit Dashboard Spec

## Spreadsheet Ownership
- **Owning spreadsheet**: `AUDIT_SPREADSHEET_ID` when configured; otherwise `TRAINING_SPREADSHEET_ID`.
- **Data source policy**: This dashboard reads local tabs in the resolved audit workbook only (`Audit` and dashboard tabs in this workbook); this workbook is the canonical audit ledger of record.
- **Cross-workbook rule**: Do not assume tabs from onboarding or training workbooks exist here. Use explicit `IMPORTRANGE("<spreadsheet_id>", "<tab>!<range>")` only when a cross-workbook feed is intentionally configured.

## Required Tabs
- `Audit_Dashboard`
- `Audit_KPI`
- `Audit_Pivot`

## KPI Cards
1. `total_event_count`: total audit events.
2. `last_24h_event_count`: events with `event_timestamp >= NOW()-1`.
3. `unique_actor_count`: distinct `actor_email` over selected window.
4. `status_change_event_count`: events where `action` = `STATUS_CHANGE`.
5. `entity_change_rate`: updates per entity over selected period.

## Pivot Dimensions
- `entity_type`
- `action`
- `actor_email`
- `event_date`
- `event_hour`

## Named Ranges and Named Functions for Charts

### Named ranges
- `AUD_SOURCE_ROWS` -> `Audit!A:H`
- `AUD_KPI_TABLE` -> `Audit_KPI!A:F`
- `AUD_PIVOT_TABLE` -> `Audit_Pivot!A:F`

### Named functions
- `SYS_MAKE_ID(prefix, dt, seq, trigger)` for ID-pattern compliance monitoring charts.
- `SYS_EVENT_KEY(entity_id, event_type, event_ts)` for dedupe-safe event trend charting.
