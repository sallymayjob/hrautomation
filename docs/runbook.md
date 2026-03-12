# HR Automation Runbook

This runbook defines daily operations and incident handling for the HR automation workflow (triggered reminders, welcome DMs, and sheet-backed state). Use this document during normal production support.

## 1) Daily Checks

Perform these checks at the start of every support shift.

### 1.1 Service Health
1. Open the Apps Script project and verify the latest trigger runs completed without unhandled exceptions.
2. Check execution logs for the previous 24 hours:
   - No repeated timeout or authorization errors.
   - No surge in BLOCKED statuses.
3. Confirm the Workspace bot account is active and can post DMs.

### 1.2 Sheet Integrity
1. Open the production onboarding, training, and audit spreadsheets and validate required tabs are present. Confirm Script Properties map each tab correctly (`ONBOARDING_SPREADSHEET_ID`/`ONBOARDING_SHEET_NAME`, `TRAINING_SPREADSHEET_ID`/`TRAINING_SHEET_NAME`, `AUDIT_SPREADSHEET_ID`/`AUDIT_SHEET_NAME`).
2. Spot-check the newest 10 rows in the processing tab:
   - Status transitions are valid (e.g., PENDING -> IN_PROGRESS -> COMPLETE, with BLOCKED when gates fail).
   - Timestamps are populated and in expected timezone.
3. Confirm there are no accidental schema edits (missing columns, renamed headers, broken formulas).

### 1.3 Backlog and Delivery
1. Count PENDING rows older than SLA threshold (typically 1 hour).
2. Review BLOCKED rows created since last check.
3. Validate at least one successful DM in the last 24 hours (if no eligible recipients, annotate that in handoff notes).

### 1.4 Handoff Note
Record in ops handoff:
- Time checks completed.
- Counts of PENDING / IN_PROGRESS / BLOCKED / COMPLETE.
- Any actions taken and open risks.

---

## 2) Manual Reminder Trigger Execution

Use this when scheduled trigger did not fire, or after fixes requiring immediate catch-up.

1. Open Apps Script -> **Triggers** and confirm the normal time-based trigger exists.
2. Go to **Executions** and verify there is no currently running duplicate job.
3. Manually run the reminder entrypoint function (for example `runReminderTrigger` / deployment-specific equivalent).
4. Monitor execution in real time:
   - Confirm start timestamp.
   - Confirm processed row count > 0 when eligible rows exist.
   - Confirm completion without exception.
5. Validate outcome in sheet:
   - Processed rows changed from PENDING to IN_PROGRESS (or BLOCKED with reason).
6. If manual run succeeds but scheduler failed, recreate the broken trigger and document incident.

**Guardrail:** Never run manual trigger repeatedly in rapid succession. Wait for the prior execution to finish to avoid duplicate DMs.

---

## 3) Role/Resource Updates

Perform this when ownership or access scope changes.

### 3.1 Role Changes
1. Identify incoming and outgoing operators.
2. Update access for:
   - Apps Script project (Editor/Viewer as needed).
   - Google Sheet.
   - Workspace bot administration console.
3. Remove least-privilege violating access immediately for departed users.
4. Log change in Audit Log tab with actor, timestamp, and reason.

### 3.2 Resource Changes
1. For new sheet/resource IDs, update Script Properties for spreadsheet IDs and tab names (`ONBOARDING_SPREADSHEET_ID`, `TRAINING_SPREADSHEET_ID`, `AUDIT_SPREADSHEET_ID`, `ONBOARDING_SHEET_NAME`, `TRAINING_SHEET_NAME`, `AUDIT_SHEET_NAME`, and `CHECKLIST_SHEET_NAME`).
2. Validate connector access with a non-production dry-run row.
3. Re-run a controlled manual trigger and verify delivery.
4. Update runbook links/bookmarks used by on-call staff.

---

## 4) BLOCKED Row Remediation

Use this flow for rows marked BLOCKED.

1. Filter rows where `status = BLOCKED`.
2. Classify each failure cause:
   - **Transient** (rate limit, timeout, temporary API error).
   - **Data issue** (missing user ID, malformed row fields).
   - **Permission/auth** (token revoked, connector unauthorized).
3. For gate/data blockers:
   - Fix external condition (wait/retry window).
   - Set row to IN_PROGRESS after resolving blockers.
   - Re-run trigger once.
4. For checklist gate issues:
   - Resolve each missing required task listed in `blocked_reason` by phase (Documentation, Pre-onboarding, Day-1 readiness).
   - Example blockers: missing contract signature, missing Google account test verification.
5. Record remediation result in Audit Log (row ID, root cause, operator, action, final status).

**Do not** delete BLOCKED rows; retain for auditability.

---

## 5) Re-send Welcome DM Workflow

Use when a user reports not receiving onboarding DM.

1. Verify recipient eligibility:
   - Correct user identifier.
   - User is active and contactable by bot.
2. Search sheet history for existing welcome DM record:
   - If IN_PROGRESS exists, confirm timestamp and target user.
   - If BLOCKED exists, remediate root cause first.
3. Create a controlled resend:
   - Duplicate or requeue the row with explicit `manual_resend = true` marker (or deployment equivalent).
   - Add operator note referencing ticket ID.
4. Execute manual trigger for the single recipient batch when possible.
5. Confirm delivery success in logs and mark resolution in support ticket.
6. If resend fails twice, escalate to connector/auth investigation.

---

## 6) Token Rotation (Routine)

Perform on scheduled security cadence or immediately after credential hygiene events.

1. Generate a new bot token in the provider admin console.
2. Store token in approved secret store first (never in sheet cells or code comments).
3. Update Apps Script secret/config property with new token.
4. Run a connectivity smoke test:
   - auth check endpoint (if available), then
   - one controlled DM to test account.
5. If successful, revoke old token.
6. Document rotation in Audit Log with timestamp, operator, and evidence of successful post-rotation test.

**Security requirements**
- Never share token over chat/email.
- Never commit token values to repository.
- Revoke immediately if accidental exposure is suspected.

---

## 7) Weekly Reporting and HR Approvals Digest

Use this procedure once per week (or on-demand after significant data corrections) to refresh computed onboarding metrics, regenerate summary tabs, and publish the HR approvals digest.

1. Run the weekly reporting entrypoint (`postWeeklyMetrics`).
2. Confirm the following summary tabs are present and updated:
   - `Summary - By Employee`
   - `Summary - By Team Owner`
   - `Summary - By Category`
   - `Summary - Blocked Onboarding`
3. In `Summary - By Employee`, validate computed fields per onboarding record:
   - `tasks_total`
   - `tasks_done`
   - `tasks_overdue`
   - `completion_pct`
4. Validate digest delivery in the HR approvals channel (configured as `HR_TEAM_CHANNEL_ID`).
5. Review the blocked-onboarding section in both the digest and `Summary - Blocked Onboarding` tab:
   - Prioritize records with highest overdue counts.
   - Use top unresolved task list to assign remediation owners.

### 7.1 Digest Troubleshooting
1. If digest is missing:
   - Check Apps Script execution logs for Slack API errors.
   - Verify `SLACK_BOT_TOKEN` and `HR_TEAM_CHANNEL_ID` properties.
2. If summary tabs are stale:
   - Re-run `postWeeklyMetrics`.
   - Confirm onboarding/checklist tabs still use expected headers.
3. If blocked list is unexpectedly empty:
   - Verify onboarding `status` values are correctly set to `BLOCKED` where appropriate.
   - Confirm unresolved checklist tasks are not incorrectly marked `DONE`/`COMPLETE`.


---

## 8) Schema Upgrade Path (Ordered Migration)

When rolling out schema-affecting releases, apply changes in this exact order to avoid writes being blocked by schema/version guards:

1. **Schema update (sheets first)**
   - Update headers on `Onboarding`, `Training`, and `Audit` tabs to match repository schema files.
   - Ensure `_sys_config` exists in each workbook with these rows:
     - `Onboarding.schema_version = 3`
     - `Training.schema_version = 1`
     - `Audit.schema_version = 1`
2. **Named functions update**
   - In each workbook, confirm required named functions are present and current:
     - `SYS_MAKE_ID`
     - `SYS_IS_COMPLETE`
     - `SYS_EVENT_KEY`
   - Run the named-function verification routine and resolve any `#NAME?` findings before continuing.
3. **Script deploy**
   - Deploy Apps Script code only after sheet schema + named functions are ready.
   - Run a controlled test execution and verify no `SCHEMA_WRITE_BLOCKED` structured errors are appended to Audit.

Rollback note: if deployment fails validation, revert script deployment, restore prior sheet headers/metadata, and re-apply migration in order.
