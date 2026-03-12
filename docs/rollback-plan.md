# HR Automation Rollback Plan

Use this plan when production behavior regresses after a deployment, configuration change, or credential event.

## Severity Trigger

Initiate incident response if delivery reliability is degraded, data is being corrupted, or authentication fails for production messaging.

## 1) Trigger Recovery

Objective: restore reliable scheduled execution.

1. Open Apps Script -> **Triggers** and capture current trigger inventory (screenshot or text snapshot in incident notes).
2. Disable newly added/modified triggers from the incident window.
3. Recreate the last known-good trigger configuration:
   - Correct function entrypoint.
   - Correct frequency/time window.
   - Correct deployment/environment binding.
4. Execute one controlled manual run.
5. Confirm expected behavior in logs and sheet status transitions.
6. If still unstable, roll back script/library version to the last known-good deployment and re-test.
7. Record both version numbers in incident notes:
   - Previous known-good version.
   - Failed candidate version.

## 2) Bot Token Emergency Rotation

Objective: contain credential compromise and restore DM capability.

1. Immediately revoke suspected compromised token.
2. Generate emergency replacement token.
3. Update secret store / script properties with replacement token.
4. Validate with:
   - auth test,
   - single-user DM smoke test,
   - one scheduled or manual batch test.
5. Annotate incident timeline with revoke time, rotate time, and test evidence.
6. Notify security/ops stakeholders of completion.

## 3) Sheet Corruption Handling via Audit Log

Objective: recover authoritative state when production sheet is altered incorrectly.

1. Freeze writes:
   - Pause triggers and stop manual runs.
2. Assess corruption scope:
   - Missing columns/tab deletions.
   - Formula damage.
   - Row-level accidental edits.
3. Reconstruct from Audit Log:
   - Identify last known-good checkpoint time.
   - Replay validated changes after checkpoint.
4. Restore schema (headers, tab names, formulas, data validation rules).
5. Perform integrity checks:
   - Required columns present.
   - Unique IDs preserved.
   - Status lifecycle logic still valid.
6. Resume service with controlled batch and monitor for recurrence.

## 4) WFB Connector Re-auth

Objective: restore connector authorization failures (WFB = workflow/backend connector used by DM pipeline).

1. Confirm failures are auth-related from logs (401/403, revoked grant, invalid refresh token).
2. Re-authenticate connector in provider console.
3. Update stored credentials/secrets if new values were issued.
4. Validate read/write scopes required by automation.
5. Run a controlled end-to-end test (sheet read -> DM send -> status writeback).
6. Re-enable paused triggers after successful verification.

## 5) Mandatory 15-minute Production DM Failure Decision Rule

**Rollback decision rule text (verbatim):**

> Mandatory 15-minute production DM failure decision rule: if production DM delivery failures persist for 15 consecutive minutes, roll back to the last known-good deployment/configuration immediately, then continue incident triage on the rolled-back baseline.

## 6) Post-Rollback Checklist

1. Confirm production DMs are succeeding.
2. Confirm no queue growth beyond normal baseline.
3. Confirm FAILED rows are no longer increasing abnormally.
4. Publish incident update including:
   - Triggered rollback condition.
   - Rollback version/config used.
   - Current customer impact status.
5. Create follow-up action items for root-cause fix before re-release.

## 7) Dashboard Schema Mismatch Rollback (Tabs/Headers)

Objective: recover dashboard integrity when tab names or header schemas drift from spec.

1. Freeze dashboard-writing automation:
   - Pause scheduled jobs and manual routines that refresh dashboard tabs.
2. Identify mismatch scope:
   - Compare workbook tabs/headers with:
     - `docs/dashboards/onboarding-dashboard.md`,
     - `docs/dashboards/training-dashboard.md`,
     - `docs/dashboards/audit-dashboard.md`.
3. Protect historical data before repair:
   - Duplicate impacted dashboard tabs with timestamp suffix (example: `Onboarding_Pivot_backup_2026-01-14_1030`).
4. Restore schema safely:
   - Recreate missing required tabs.
   - Restore missing header cells in row 1.
   - Do **not** rewrite or delete historical data rows to force schema alignment.
5. Resolve hard conflicts:
   - If row-1 header values conflict with required schema, create a new compliant tab, point charts to the new tab, and retain legacy tab as read-only evidence.
6. Re-validate data source boundaries:
   - Ensure dashboard formulas only reference local workbook tabs unless explicit `IMPORTRANGE` is configured and documented.
7. Resume service with controlled verification:
   - Run one manual dashboard refresh.
   - Verify KPI cards, pivots, and chart references resolve without `#REF!` or `#N/A` schema errors.

## 8) Library Version Rollback Reference

For shared library release incidents, follow `docs/library-rollout-policy.md` and include these fields in the rollback log:

1. Previous known-good library version number used by production.
2. Candidate version that was rolled back.
3. Confirmation that Onboarding and Audit were both reset to the same known-good version.
4. Name of approver authorizing rollback and re-rollout.
