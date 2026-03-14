# Shared HR Library API Entry Schema

This document defines the **versionable public API surface** exposed by `gas/SharedHrLibrary.gs`.

## Compatibility policy

- Public methods listed below are semver-stable (`v1`) and may be consumed by external scripts.
- Helper/internal functions use trailing `_` and are explicitly non-contract.
- Entrypoint adapters (`gas/Code.gs`, `gas/LmsWebhook.gs`, `gas/Triggers.gs`) remain local integration boundaries.

## Public methods (`v1`)

### `processOnboardingBatch(rows, options?)`
- Input: `Array<Object>` rows with onboarding fields.
- Output: `{ successCount, errorCount, errors[], traceId }`.
- Notes: Validation-only processing; no sheet writes.

### `runAuditChecks(rows, options?)`
- Input: `Array<Object>` audit rows.
- Output: `{ successCount, errorCount, errors[], traceId }`.

### `processTrainingAssignments(rows, options?)`
- Input: `Array<Object>` assignment rows.
- Output: `{ successCount, errorCount, errors[], traceId, counts: { assigned, skipped } }`.

### `runTrainingReminders(rows, options?)`
- Input: `Array<Object>` reminder rows.
- Output: `{ successCount, errorCount, errors[], traceId, counts: { dueSoon, overdue, notDue } }`.

### `syncTrainingCompletion(rows, options?)`
- Input: `Array<Object>` completion rows.
- Output: `{ successCount, errorCount, errors[], traceId, counts, updates[] }`.

### `resolveOnboardingCandidates(rows, query)`
- Input: onboarding sheet-like rows (`Array<Array<any>>`) plus query string.
- Output: `{ matchType, candidates[] }`.
- Notes: Pure matching helper for reusable status lookup policy.

### `computeGovernedProposalHash(proposal)`
- Input: proposal object.
- Output: deterministic hash string used for approval/commit integrity.

## Non-contract helpers

Examples of intentionally private helpers:
- `getTraceId_`
- `buildResult_`
- Any method with trailing `_` in internal modules.

