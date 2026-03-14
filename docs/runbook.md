# HR Automation Runbook

This runbook defines daily operations and incident handling for the HR automation workflow (triggered reminders, welcome DMs, and sheet-backed state). Use this document during normal production support.


## Slack read-only verification guardrail
Slack command output and Slack message interactions are **read-only** for onboarding/checklist verification.
- Investigate and verify from Slack, but do not perform status edits there.
- Perform all onboarding/checklist status changes in Google Sheets.
- If someone requests Slack status buttons, decline and route to Sheets update procedure.

## 0) Workflow Map Ownership and Handoff States

Use this ownership split when deciding where to execute or remediate actions:

- **Onboarding spreadsheet** owns: new hire intake, account provisioning start, and Day-1 readiness.
- **Training spreadsheet** owns: course assignment, completion tracking, overdue reminders, and manager escalation.
- **Audit spreadsheet** owns: policy/compliance verification, evidence snapshots, and unresolved exception reporting (canonical ledger workbook, separate from onboarding and training).

### Cross-sheet handoff contract

All sheet-to-sheet handoffs must join on shared key `EmployeeID`.

1. `ONBOARDING_COMPLETE` in the Onboarding sheet triggers **Training intake** for the same `EmployeeID`.
2. `TRAINING_COMPLETE` in the Training sheet triggers **Audit eligibility** for the same `EmployeeID`.

Operational rule: perform the action in the owner sheet above; only advance to the next sheet when the handoff status is set and `EmployeeID` is present.

---

## 1) Daily Checks

Perform these checks at the start of every support shift.

### 1.1 Service Health
1. Open the Apps Script project and verify the latest trigger runs completed without unhandled exceptions.
2. Check execution logs for the previous 24 hours:
   - No repeated timeout or authorization errors.
   - No surge in BLOCKED statuses.
3. Confirm the Workspace bot account is active and can post DMs.

### 1.2 Sheet Integrity
1. Open the production onboarding, training, and audit spreadsheets and validate required tabs are present. Confirm Script Properties map each tab correctly (`ONBOARDING_SPREADSHEET_ID`/`ONBOARDING_SHEET_NAME`, `TRAINING_SPREADSHEET_ID`/`TRAINING_SHEET_NAME`, `AUDIT_SHEET_NAME`, and `CHECKLIST_SPREADSHEET_ID`/`CHECKLIST_SHEET_NAME`). `AUDIT_SPREADSHEET_ID` is optional and falls back to `TRAINING_SPREADSHEET_ID` when not set.
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
4. Log change in the Audit spreadsheet (`Audit` tab) with actor, timestamp, and reason.

### 3.2 Resource Changes
1. For new sheet/resource IDs, update Script Properties for spreadsheet IDs and tab names (`ONBOARDING_SPREADSHEET_ID`, `TRAINING_SPREADSHEET_ID`, optional `AUDIT_SPREADSHEET_ID`, `CHECKLIST_SPREADSHEET_ID`, `ONBOARDING_SHEET_NAME`, `TRAINING_SHEET_NAME`, `AUDIT_SHEET_NAME`, and `CHECKLIST_SHEET_NAME`).
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
5. Record remediation result in the Audit spreadsheet (`Audit` tab) (row ID, root cause, operator, action, final status).

**Do not** delete BLOCKED rows; retain for auditability.

---


## 4.1) Manual Checklist Status Update Procedure

Use this for operations-led status corrections when onboarding is BLOCKED.

1. Open the standalone checklist workbook (not onboarding workbook) using the configured `CHECKLIST_SPREADSHEET_ID`.
2. Locate the row by `task_id` + `onboarding_id`.
3. Update only manual columns unless template ownership changed by design:
   - `status` (allowed: `PENDING`, `IN_PROGRESS`, `BLOCKED`, `COMPLETE`, `DONE`)
   - `updated_at` (current timestamp)
   - `updated_by` (operator email/handle)
   - `notes` (ticket/reference + rationale)
4. Do **not** edit generator-controlled columns (`phase`, `task_name`, `owner_team`, `owner_slack_channel`, `due_date`) during remediation.
5. Re-attempt onboarding completion after required checklist statuses are complete.

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
6. Document rotation in the Audit spreadsheet (`Audit` tab) with timestamp, operator, and evidence of successful post-rotation test.

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
4. **Scheduled trigger health verification (post-deploy)**
   - Run `validateRequiredTriggers` once after deployment and confirm all required handlers are present.
   - Verify a `TRIGGER_HEALTHY` audit event is recorded; if any handlers are missing, remediate trigger setup and re-run validation.
   - Enable notifications (`notify: true`) during deployment windows so missing handlers alert HR Ops Slack/email immediately.

Rollback note: if deployment fails validation, revert script deployment, restore prior sheet headers/metadata, and re-apply migration in order.

## 9) Shared Library Version Rollout Policy

Follow `docs/library-rollout-policy.md` for all shared Apps Script library releases.

Mandatory rules:

1. Publish an immutable library version with a changelog before workbook upgrades.
2. Keep Onboarding and Audit pinned to the same stable version.
3. Upgrade Onboarding first; upgrade Audit only after Onboarding validation passes.
4. Keep rollback notes with the previous known-good version and restore steps.
5. Capture who approved the bump and where version references were updated.



## 10) Governed Write Pipeline Operations

All governed write operations (LMS webhook mutations and Slack write-like intents) must follow this sequence:

1. Capture as a draft proposal in `SubmissionController`.
2. Run Gemini clarification/validation (`GeminiService.validateAndClarify`).
3. Route to approvals (`ApprovalController.requestLiamApproval`/`requestApproval`).
4. Commit only from repository commit paths after approval state is `APPROVED`.

Operational checks:
- Confirm proposal exists and includes `trace_id`, `entity_type`, and `entity_key`.
- Confirm Gemini result is not rejected before requesting approval.
- Confirm commit logs show repository commit action and matching proposal hash/version.
- If approval/hash/version mismatch occurs, do not bypass guardrails; re-open proposal review.


## 11) Manual vs Automation-Owned Field Matrix

Use this matrix when operators request sheet edits. "Manual-safe" means operators may update during remediation. "Automation-owned" means edits should be avoided and guarded by write policies.

| Tab | Manual-safe fields | Automation-owned fields |
| --- | --- | --- |
| Onboarding | `employee_name`, `email`, `role`, `start_date`, `manager_email`, `brand`, `region`, `dob` | `onboarding_id`, `slack_id`, `manager_slack_id`, `buddy_slack_id`, `status`, `dm_sent_at`, `checklist_completed`, `row_hash`, `blocked_reason` |
| Checklist Tasks | `status`, `updated_by`, `notes`, `due_date` | `task_id`, `onboarding_id`, `phase`, `task_name`, `owner_team`, `owner_slack_channel`, `updated_at` |
| Training | `completion_date`, `celebration_posted`, `owner_email`, `reminder_count`, `last_reminder_at` | `employee_id`, `module_code`, `module_name`, `assigned_date`, `due_date`, `training_status`, `completion_hash`, `last_updated_at` |
| Audit | _None_ (treat as append-only automation ledger) | `audit_id`, `event_timestamp`, `actor_email`, `entity_type`, `entity_id`, `action`, `details`, `event_hash` |

### Write guard behavior

- Manual edits to managed identity fields (`onboarding_id`, `row_hash`, and cross-sheet join keys) can be configured in either:
  - `log` mode: allow edit and record audit event.
  - `reject` mode: revert the change and record audit event.
- Toggle with script properties:
  - `MANAGED_WRITE_GUARD_ENABLED` (`true`/`false`)
  - `MANAGED_WRITE_GUARD_MODE` (`log`/`reject`)

### Periodic managed-field validator

- Schedule `runPeriodicValidator` daily to scan Onboarding, Checklist Tasks, Training, and Audit tabs.
- Validator flags rows with:
  - missing managed keys,
  - missing status values (when status column is required),
  - invalid status values outside policy allowlists.
- Review results in execution logs and remediate in owner sheets.

