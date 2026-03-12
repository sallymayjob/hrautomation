# Library Entry Schema (Canonical)

This project defines one canonical row contract for **library entry points** that ingest or emit onboarding audit rows.

## Config tab requirements

- Tab name: `_sys_config`
- Required key/value row: `version` = `schema_v1`

`SheetClient.ensureSchemaVersionMetadata()` now ensures this marker is present in each workbook `_sys_config` tab.

## Canonical required columns

The `SheetClient.validateSchema(headers)` guard enforces this **exact order** and **exact header names**:

1. `EmployeeID` (`string`)
2. `FullName` (`string`)
3. `WorkEmail` (`string(email)`)
4. `StartDate` (`date`)
5. `Department` (`string`)
6. `ManagerEmail` (`string(email)`)
7. `OnboardingStatus` (`string(enum)`)
8. `AuditStatus` (`string(enum)`)
9. `LastUpdated` (`datetime`)

If headers drift, the guard throws a human-readable error that includes:

- expected header order
- expected data type map
- per-column mismatch details

## Operational tab names used by library functions

These tabs are the sheet names expected by existing `SheetClient` workflows (resolved from Script Properties):

- Onboarding tab: `Config.getOnboardingSheetName()`
- Training tab: `Config.getTrainingSheetName()`
- Audit tab: `Config.getAuditSheetName()`
- Checklist tab: `Config.getChecklistSheetName()`

Those functions continue using their existing per-sheet schemas (`SHEET_SCHEMA_SPECS`) for write safety and version checks.
