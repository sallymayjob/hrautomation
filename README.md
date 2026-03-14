# HR New-Starter Automation Helper

## What is this?
This project is a **helper system** for HR teams.

It uses:
- **Slack** (for messages and quick checks)
- **Google Sheets** (as the main record book)
- **Google Apps Script** (the automation engine that runs on a schedule)

Think of it like a digital assistant that:
- checks who is joining,
- sends reminders,
- tracks progress,
- and records what happened.

---

## Who is this for?
- HR team members
- Team leaders (IT, Finance, People/Admin)
- Operations staff
- Anyone supporting onboarding and training progress

You do **not** need to be a developer to understand basic operation.

---

## What this system does (in simple terms)
1. Watches onboarding data in Google Sheets.
2. Creates onboarding tasks/checklist items.
3. Sends Slack reminders for upcoming or overdue training/tasks.
4. Escalates overdue work to the right people.
5. Writes audit/history logs so teams can review what happened.
6. Builds weekly summary views for reporting.

It also has a “proposal + approval” path for risky write-like actions so changes are reviewed before final commit.

---

## Important rule: Slack is read-only for status edits
In this project, Slack command responses are for **checking status**, not editing it.

- ✅ Use Slack to **view** status
- ✍️ Make actual status changes in **Google Sheets**

---

## Main workflows

### 1) Onboarding workflow
- A new onboarding row appears in the Onboarding sheet.
- The system checks required fields.
- It generates checklist tasks and training assignments.
- It sends assignment notifications.
- It marks blockers if required tasks are missing.

### 2) Reminder workflow
- Runs on a schedule.
- Finds due-soon, due-today, and overdue items.
- Sends reminder messages.
- Sends escalations for overdue items.

### 3) Reporting workflow
- Builds weekly summaries in reporting tabs.
- Helps HR and owners quickly see progress and blockers.

### 4) Governed write workflow
- Write-like requests are captured as proposals.
- Proposal is validated.
- Approval step is required (if configured).
- Only approved proposals should be committed.

---

## How the system is built (simple architecture)
- **Slack layer**: where people interact (commands/messages).
- **Automation layer (Apps Script)**: runs business rules and scheduled jobs.
- **Data layer (Google Sheets)**: stores onboarding, checklist, training, and audit records.
- **Governance layer**: proposal, validation, approval controls for sensitive changes.

---

## Folder guide
- `gas/` → automation code (Apps Script)
- `sheets/` → sheet schema files and sample CSVs
- `docs/` → operating docs, runbooks, architecture notes
- `templates/` → message templates
- `workflows/` → Slack workflow mapping files
- `tests/` → automated tests

---

## Most important files
- `gas/Code.gs` → web entry point (`doPost`) and onboarding event routing
- `gas/Commands.gs` → Slack command/request handler logic used by `doPost`
- `gas/LmsWebhook.gs` → LMS/workflow webhook handler (`doPostLms`)
- `gas/OnboardingController.gs` → onboarding logic
- `gas/Reminders.gs` → reminder and escalation logic
- `gas/Reporting.gs` → weekly summaries
- `gas/Triggers.gs` → scheduled trigger setup
- `gas/Config.gs` → configuration values (Script Properties)
- `DEPLOYMENT.md` → step-by-step deployment guide

---

## Data model (plain language)
The system uses Sheets as tables:
- **Onboarding**: starter info and onboarding status
- **Checklist Tasks**: task list per onboarding record
- **Training**: module assignments and completion status
- **Audit**: history log of important actions/events

IDs help connect records across sheets:
- `onboarding_id`
- `task_id`
- `employee_id`
- `module_code`

---

## Integrations in use
- Slack (messaging + status commands)
- Google Sheets (data storage)
- Google Apps Script (automation runtime)
- Slack Workflow Builder (required source for LMS webhook handshakes)
- Gemini validation layer (used in governed proposal flow)

---

## What you need before using this
- Google account with access to Sheets + Apps Script
- Slack workspace with app setup permission
- Required Sheets created with correct tabs/headers
- Script Properties configured (IDs, names, tokens, channels)

### Slack channel setup (required)
Use `docs/slack-channels-guide.md` to set up channels correctly.

How to use it:
1. Create each required channel with the exact name listed.
2. Follow the privacy/type guidance (public/private).
3. Invite the bot to each required channel.
4. Copy channel IDs and keep them for Script Properties setup.

---

## Configuration (where settings live)
Settings are stored in Apps Script **Script Properties**.
Examples:
- spreadsheet IDs and sheet names
- Slack bot token
- Slack channel IDs
- governance toggles

See `DEPLOYMENT.md` for the full checklist and setup order.

---

## Local editing (for technical helpers)
If a technical person is updating code:
- Run tests: `npm test -- --runInBand`
- Run lint: `npm run lint`
- Required pre-merge hardening gate: `npm run test:ci-gate` (must pass before production hardening merges).

If you are non-technical, you can ignore this section.

---

## Known limitations (important)
- Slack request-signature verification is not clearly shown in current ingress code.
- Proposal storage in `SubmissionController` appears in-memory by default (needs environment verification for durable storage).
- Some behavior depends on manual environment setup outside this repo.
- Some channels/settings are environment-specific.

---

## Where to go next
- Setup instructions: `DEPLOYMENT.md`
- Day-to-day operations: `docs/runbook.md`
- Architecture details: `docs/repository-architecture-map.md`
