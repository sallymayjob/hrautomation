# Deployment Guide (Zero-Tech Friendly)

## 1) What are we deploying?
You are setting up an HR helper system that:
- reads onboarding/training/checklist data from Google Sheets,
- sends reminders in Slack,
- runs scheduled checks automatically,
- and keeps an audit history.

This system runs in **Google Apps Script** and connects to **Slack** and **Google Sheets**.

---

## 2) Before you start
You need:
1. A Google account with permission to edit Sheets and Apps Script.
2. A Slack workspace where you can create/install apps.
3. The required Google Sheets (Onboarding, Training, Checklist, Audit).
4. Access to this repository’s schema/sample files.

If you do not have these permissions, ask your admin first.

---

## 3) Big picture setup order
Follow this order exactly:
1. Prepare Google Sheets and tab headers.
2. Create/configure Slack app.
3. Deploy Apps Script as a web app.
4. Add Script Properties (settings).
5. Create scheduled triggers.
6. Run smoke tests.

---

## 4) Prepare Google Sheets
Create (or verify) these sheet areas:
- Onboarding
- Training
- Checklist Tasks
- Audit

Use schema files in `sheets/` as your source of truth for column headers.

If headers do not match expected schema, workflows can fail or skip rows.

---

## 5) Slack app setup (simple)
Create a Slack app and install it to your workspace.

You will need:
- Bot token (`xoxb-...`)
- Slash commands for status checks
- Callback URL(s) that point to your deployed Apps Script web app

Slack app manifest source of truth: `manifest.json` at the repository root (the `workflows/manifest.json` duplicate was removed).

Supported slash commands in this repo:
- `/onboarding-status`
- `/it-onboarding-status`
- `/finance-onboarding-status`
- `/hr-onboarding-status`
- `/checklist-status`
- `/checklist-progress`

Important:
- Slack command responses are read-only for onboarding/checklist updates.
- LMS write operations must come from Slack Workflow Builder handshake source.

Needs verification:
- Final production scope list and security policy specifics for your workspace.

### 5.1) Setup Slack channels (required before testing)
Use this file: `docs/slack-channels-guide.md`

How to use that guide:
1. Open `docs/slack-channels-guide.md`.
2. Create the required channels with the exact names shown in the table.
3. Set channel type (public/private) as recommended in the guide.
4. Invite the Slack bot to each required channel.
5. Copy each channel ID and save it for Script Properties setup.

Minimum outcome before continuing:
- Required channels exist.
- Bot is invited to required posting channels.
- Channel IDs are saved and ready for deployment settings.

---

## 6) Deploy Apps Script
1. Open your Apps Script project containing files from `gas/`.
2. Confirm runtime uses V8.
3. Deploy as **Web App**.
4. Copy the Web App URL.
5. Put this URL into Slack command/workflow callback settings.

Optional / environment-specific:
- Shared library `HRLib` (defined in `gas/appsscript.json`).

---

## 7) Add required Script Properties
In Apps Script, open **Project Settings > Script Properties**.
Add values carefully.

### Core required settings
- `ONBOARDING_SPREADSHEET_ID`
- `ONBOARDING_SHEET_NAME`
- `TRAINING_SPREADSHEET_ID`
- `TRAINING_SHEET_NAME`
- `AUDIT_SHEET_NAME`
- `CHECKLIST_SPREADSHEET_ID`
- `CHECKLIST_SHEET_NAME`
- `SLACK_BOT_TOKEN`
- `DEFAULT_ASSIGNMENTS_CHANNEL_ID`

### Commonly required routing settings
- `HR_TEAM_CHANNEL_ID`
- `IT_TEAM_CHANNEL_ID`
- `FINANCE_TEAM_CHANNEL_ID`
- `ADMIN_TEAM_CHANNEL_ID`

### Optional / environment-specific settings
- `AUDIT_SPREADSHEET_ID` (falls back to training spreadsheet if not set)
- `MAPPING_SPREADSHEET_ID`, `MAPPING_SHEET_NAME`
- Governance datasets: lessons/mappings/approvals/submissions IDs + sheet names
- `APP_TIMEZONE`, `RETRY_MAX_ATTEMPTS`, `RETRY_DELAY_MS`
- Gemini settings: `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_ENABLED`
- Governance toggles: `GOVERNANCE_ENABLED`, `GOVERNANCE_APPROVAL_REQUIRED`

If unsure, ask your technical owner to validate your full property list against `gas/Config.gs`.

---

## 8) Create scheduled triggers
In Apps Script editor, run setup functions:
- `setupDailyTrigger`
- `setupBirthdayTrigger`
- `setupOnboardingBusinessHoursTrigger`
- `setupAuditTriggers`
- `setupTrainingTriggers`

This creates scheduled jobs such as reminders, onboarding checks, audits, and training sync.

If triggers look duplicated, run `teardownAllTriggers` and then re-run setup.

---

## 9) Smoke test (quick checks)
After setup, test these:
1. Run `/onboarding-status <name>` in Slack.
2. Add a controlled onboarding test row and run onboarding flow.
3. Run `runDailyReminders` manually for test data.
4. Run `postWeeklyMetrics` and confirm summary tabs populate.
5. Test LMS webhook path (`doPostLms`) with valid Workflow Builder handshake payload.

Expected results:
- Slack returns status responses.
- Sheet rows update as workflows run.
- Summary tabs refresh.
- Proposal flow captures governed write-like actions.

---

## 10) Troubleshooting
### Problem: “Missing config” or “Sheet not found”
- Re-check Script Property names and values.
- Confirm spreadsheet IDs and sheet tab names exactly match.

### Problem: Slack messages not sending
- Check `SLACK_BOT_TOKEN`.
- Confirm app scopes and channel membership.

### Problem: Workflow does not run on schedule
- Check trigger list in Apps Script.
- Re-run setup functions.

### Problem: Write-like action accepted but no final data change
- This can be expected in governed flow: proposal captured, approval pending.

### Problem: Rows skipped or blocked
- Check schema/header alignment.
- Check required fields in onboarding/checklist/training rows.

---

## 11) Rollback and safe-change approach
When making major changes:
1. Backup/export affected sheets.
2. Apply schema/header changes first.
3. Deploy script changes in small steps.
4. Test manually before enabling full schedule.
5. If issues occur, revert to prior Apps Script deployment version.
6. Re-check triggers after rollback.

---

## 12) Operational notes (daily/weekly care)
- Review Apps Script execution logs regularly.
- Watch for repeated failures, blocked rows, or missing reminders.
- Keep sheet headers stable (avoid manual renaming).
- Use runbook procedures for manual fixes.

Helpful docs:
- `docs/runbook.md`
- `docs/architecture-dataflow.md`
- `docs/repository-architecture-map.md`

---

## 13) Open questions (be transparent)
These are not fully confirmed by current code alone:
1. Slack signing-secret verification implementation for ingress endpoints.
2. Durable (non-memory) production storage path for proposal state.
3. Exact production owner/process for final approval commit operations.
4. Whether all optional governance datasets are required in your environment.
5. Whether deployment is fully manual or partially automated outside this repo.
