# Repository Architecture Map

## 1. System Purpose
This repository implements an HR operations automation system centered on Google Apps Script + Google Sheets with Slack as the primary interaction surface.

Implemented scope in code:
- Onboarding intake processing and checklist/task generation.
- Training assignment, reminders, escalation, and completion-linked recognition.
- Weekly reporting summaries written back to Sheets.
- Governance pipeline for write-like intents (proposal -> Gemini validation -> approval gate -> repository commit).
- LMS webhook intake restricted to Slack Workflow Builder handshakes.

The system explicitly enforces **Slack read-only verification** for onboarding/checklist status queries and routes operational status changes to Sheets.

## 2. Technology Stack
- **Runtime:** Google Apps Script (V8).
- **Data layer:** Google Sheets (multiple workbooks/tabs for onboarding, training, checklist, audit, mappings, submissions, approvals, lessons).
- **Chat/integration:** Slack Web API (`chat.postMessage`, `users.lookupByEmail`) and Slack slash command/webhook entrypoints.
- **Governance/AI:** Gemini validation shim (`GeminiService`) for proposal clarification/rejection checks.
- **Automation:** Apps Script time-based triggers plus Slack Workflow Builder initiated webhook handshakes.
- **Testing/tooling:** Jest unit/integration tests and ESLint in Node-compatible test harness.

## 3. Top-Level Folder Map
- `gas/`: Production Apps Script code (entrypoints, controllers, repositories, clients, workflow wrappers).
- `sheets/`: Schema contracts (`*-schema.json`) plus CSV seed/sample datasets.
- `templates/`: Slack Block Kit / messaging payload templates.
- `docs/`: Operational/runbook and architecture documentation.
- `workflows/`: Slack workflow mapping and workflow manifest artifacts.
- `tests/`: Unit + integration test suites for key modules and flows.

## 4. Entry Points and Trigger Map
### Web endpoints / command ingress
- `doPost(e)` in `gas/Commands.gs`: Slack slash command + interactive payload ingress.
  - Parses `payload` envelopes.
  - Returns read-only responses for interactive payloads.
  - Supports read-only command set: `/onboarding-status`, `/it-onboarding-status`, `/finance-onboarding-status`, `/hr-onboarding-status`, `/checklist-status`, `/checklist-progress`.
  - Detects write-like command text and routes to governed proposal capture.
- `doPostLms(e)` in `gas/LmsWebhook.gs`: LMS action ingress for Slack Workflow Builder handshakes only.
  - Rejects non-workflow-builder sources.
  - Validates supported action names.
  - Captures draft proposal and blocks direct commits pending approval.

### Apps Script execution entrypoints
- `onChangeHandler(e)` in `gas/Code.gs`: sheet-change ingress normalization + onboarding routing.
- `runOnboardingManual()` in `gas/Code.gs`: manual onboarding runner.
- Trigger wrappers in `gas/LibraryWrappers.gs`:
  - `runOnboardingBusinessHours`, `runOnboarding`, `runAudit`, `runAuditDeepWeekly`, `runTrainingAssignments`, `runTrainingReminders`, `runTrainingSync`.

### Trigger setup map
`gas/Triggers.gs` provisions time-based triggers:
- Daily reminders (`runDailyReminders`) at 09:00.
- Birthday/anniversary checks at 08:00.
- Onboarding business-hours runner every 15 min.
- Daily audit at 07:00.
- Weekly deep audit Sunday 06:00.
- Training assignments daily at 06:00.
- Training reminders weekdays at 09:00.
- Training sync every 4 hours.

No `doGet` entrypoint is implemented.

## 5. Core Runtime Flows
### A) Onboarding flow
1. Ingress event normalized in `Code.gs` (`onChangeHandler` / `runOnboardingManual`).
2. Route only if active sheet matches configured onboarding sheet.
3. Header/schema validation gate.
4. Per-row processing for eligible rows (`status=PENDING` or checklist incomplete fallback).
5. `OnboardingController` hydrates defaults, enforces mandatory stakeholders, resolves role mapping, writes training assignments, generates checklist tasks, sends assignment notifications, and attempts completion gate transitions.
6. Lifecycle events logged to audit repository.

### B) Reminder + escalation flow
1. `runDailyReminders()` loads training + checklist rows.
2. Training reminders for due in 3 days, due today, and overdue; manager escalation after overdue threshold.
3. Checklist reminders and escalation by owner team/channel routing.
4. Duplicate suppression via hash checks in audit repository.
5. Reminder metadata updated in source repositories.

### C) Training operations flow
- Trigger wrappers call shared library execution controller (`runLibraryWorkflow_` -> `runWorkflowController_`) for assignment, reminders, and sync workflows with lock + runtime budget + exception logging.

### D) Reporting / admin flow
- `postWeeklyMetrics()` computes training and onboarding/checklist metrics.
- Writes summary tabs:
  - `Summary - By Employee`
  - `Summary - By Team Owner`
  - `Summary - By Category`
  - `Summary - Blocked Onboarding`
- Appends audit summary events for weekly digest traceability.

### E) Governed mutation flow (write-like intents + LMS)
1. Capture proposal (`SubmissionController`).
2. Validate/clarify (`GeminiService.validateAndClarify`).
3. Approval routing (`ApprovalController.requestLiamApproval` / `requestApproval`).
4. Commit requires approved state + hash/version revalidation + gate checks (`VersioningService`, `MappingService`, `DuplicateDetector`) before repository commit.

## 6. Data Layer and Sheet Schema Responsibilities
### Canonical schemas
- `sheets/onboarding-schema.json` (versioned, required headers, formula/script/workflow ownership).
- `sheets/training-schema.json` (training assignment/completion contract).
- `sheets/checklist-schema.json` (task operations contract).
- `sheets/audit-schema.json` (append-only compliance/event ledger contract).
- Additional governed datasets: `lessons-schema.json`, `mappings-schema.json`, `approvals-schema.json`, `submissions-schema.json`, `onboarding-status-tracker-schema.json`.

### Known tabs / seed datasets
- Training domain tabs under `sheets/training-tabs/`: `courses`, `modules`, `lessons`, `learners/queue`, `lesson-submissions`, `lesson-metrics`, `slack-threads`, `training-operations-log`, `audit_log`, `lesson-qa-records`.
- Base CSVs: onboarding, training, audit log, checklist, onboarding status tracker.

### Key relationships and identifiers
- `onboarding_id` as onboarding/checklist linkage key.
- `employee_id + module_code` identifies training assignments.
- `task_id + onboarding_id` identifies checklist tasks.
- `audit_id` append key in audit ledger.
- Governance entities use `proposal.id`, `trace_id`, `entity_type`, `entity_key`, `proposal_hash`, `proposal_version`.

### Sync/update behavior
- Trigger-driven periodic batch processing.
- Idempotency/duplicate detection via hashes in audit + proposal hashing.
- Schema fail-closed behavior (header validation before mutation).

## 7. Slack / API / Integration Layer
### Slack
- `SlackClient` encapsulates Web API calls with retry on 429/rate limit.
- Message rendering via `BlockKit` helpers and template JSON assets.
- Command layer is read-only for status checks; write-like text is diverted to proposal flow.

### Apps Script / Google Sheets
- `SheetClient` + repository classes separate physical sheet operations.
- `Config` resolves script properties for IDs, sheet names, channels, retry settings, governance toggles.

### External/AI
- Gemini adapter currently performs rule-based validation logic (no direct model API invocation in repository code).

### Workflow Builder / webhooks
- `doPostLms` enforces `handshake.source == slack_workflow_builder`.
- Repository docs under `workflows/` describe course/module/enrollment workflow patterns.

## 8. File-by-File Responsibility Breakdown
### Entrypoints and orchestration
- `gas/Commands.gs`: Slack command ingress + read-only status handlers + write-intent proposal routing.
- `gas/LmsWebhook.gs`: LMS webhook ingress, handshake validation, supported action routing.
- `gas/Code.gs`: onboarding ingress normalization and row processing dispatch.
- `gas/LibraryWrappers.gs`: scheduled workflow wrappers, lock/runtime enforcement, shared-library callouts.
- `gas/Triggers.gs`: trigger create/teardown helpers.

### Business logic and controllers
- `gas/OnboardingController.gs`: onboarding row workflow, stakeholder validation, checklist generation, assignment notifications, completion gates.
- `gas/Reminders.gs`: training/checklist reminder + escalation logic.
- `gas/Reporting.gs`: weekly KPI aggregation and summary tab materialization.
- `gas/Recognition.gs`: completion-triggered recognition behavior.
- `gas/ApprovalController.gs`: proposal approval/rejection transitions.
- `gas/SubmissionController.gs`: proposal lifecycle, commit gating, version/hash checks.
- `gas/GeminiService.gs`: proposal clarify/reject/valid classification.

### Repositories and data access
- `gas/SheetClient.gs`: primitive sheet read/write helpers.
- `gas/OnboardingRepository.gs`, `gas/TrainingRepository.gs`, `gas/LessonRepository.gs`, `gas/LearnerRepository.gs`, `gas/MappingRepository.gs`, `gas/AuditRepository.gs`, `gas/ReportingRepository.gs`, `gas/WorkflowSheetRepository.gs`: dataset-specific access patterns.

### Shared/domain utilities
- `gas/Config.gs`: typed script property accessors + routing constants.
- `gas/ValidationService.gs`, `gas/DuplicateDetector.gs`, `gas/VersioningService.gs`, `gas/MappingService.gs`, `gas/ChecklistTemplate.gs`, `gas/Utils.gs`, `gas/Logger.gs`: support services.
- `gas/SharedHrLibrary.gs` / `gas/LibraryWrappers.gs`: integration layer to shared HR library artifact.

### Contracts and ops docs
- `sheets/*.json`, `sheets/*.csv`: schema/seed contracts.
- `docs/*.md`: runbook, dataflow, SOP, dashboard setup.
- `tests/**/*.test.js`: executable module and flow checks.

## 9. Architectural Strengths
- Strong use of repository abstractions around Sheets reduces direct sheet mutation sprawl.
- Explicit schema/version contracts in JSON plus fail-closed guidance.
- Governance path for write-like operations introduces approval + auditability.
- Trigger wrappers include locking, runtime budget checks, and standardized execution logging.
- Broad test coverage footprint across many controllers/services.

## 10. Risks and Gaps
1. **Slack ingress security gap:** command/webhook handlers do not verify Slack signing secret/HMAC.
2. **In-memory proposal store:** `SubmissionController` stores proposals in process memory (`ProposalStore_`), which is volatile across executions and non-durable for production governance.
3. **Potential schema/header drift risk:** training schema uses mixed header casing (`Employee ID`) while required headers include snake_case (`employee_id`) in same file, increasing fragility.
4. **Read-only Slack UX mismatch risk:** code rejects interactive edits, but commands still parse write-like language and create proposals, which may confuse operators if not clearly trained.
5. **Hardcoded escalation destination:** checklist escalation posts to `#hr-ops-alerts` directly in `Reminders.gs` rather than config-driven channel.
6. **Retry strategy limited to Slack API client:** other external operations (if added) may not share robust retry/backoff patterns.
7. **Mixed concerns in some files:** large orchestration files (`Commands.gs`, `LibraryWrappers.gs`, `OnboardingController.gs`, `Reminders.gs`) combine routing, policy, and mutation logic.

## 11. Highest-Priority Refactor Targets
1. **Persist proposal lifecycle in Sheets/DB-backed repository** (replace in-memory `ProposalStore_`).
2. **Add Slack request signature verification middleware** for `doPost` and `doPostLms`.
3. **Normalize schema header conventions and enforce via single source of truth constants** (especially training schema/header mapping).
4. **Extract channel routing and escalation destinations fully into `Config`** (remove hardcoded channel literals).
5. **Split large controller files into focused modules** (ingress parsing, policy evaluation, messaging side effects, and persistence boundaries).

## 12. Suggested Next Implementation Steps
1. Implement signed request validation for Slack endpoints and reject unsigned/expired requests.
2. Create `SubmissionRepository` persisted to `submissions` + `approvals` sheets and wire `SubmissionController` to it.
3. Add idempotency key handling for webhook actions at repository boundary.
4. Introduce structured error taxonomy + centralized retry helper for non-Slack API side effects.
5. Add contract tests that assert schema headers in JSON align with repository column constants.
6. Add observability metrics sheet/log for trigger latency, failure classes, and duplicate suppression counts.

## Top 10 most important files
1. `gas/Commands.gs`
2. `gas/LmsWebhook.gs`
3. `gas/Code.gs`
4. `gas/OnboardingController.gs`
5. `gas/LibraryWrappers.gs`
6. `gas/Reminders.gs`
7. `gas/SubmissionController.gs`
8. `gas/ApprovalController.gs`
9. `gas/Config.gs`
10. `sheets/onboarding-schema.json`

## Top 5 highest-risk files
1. `gas/SubmissionController.gs` (volatile in-memory proposal persistence)
2. `gas/Commands.gs` (public ingress surface, mixed routing/policy concerns)
3. `gas/LmsWebhook.gs` (governed mutation ingress, handshake/security critical)
4. `gas/Reminders.gs` (hardcoded channel + high-volume messaging side effects)
5. `gas/OnboardingController.gs` (large multi-responsibility workflow engine)

## Top 5 missing or unclear pieces
1. Slack signature verification implementation.
2. Durable proposal persistence/approval history beyond runtime memory.
3. Explicit ownership/implementation for final repository commit path from approved proposals.
4. Clear documented mapping from all `sheets/training-tabs/*.csv` to production repository classes.
5. Unified error/retry policy across all external side effects.

## One-paragraph system summary
The system is an Apps Script-driven HR automation platform where Slack acts as intake/notification UI and Google Sheets are the source-of-truth operational store: onboarding events are normalized and expanded into checklist/training workloads, scheduled jobs send reminders/escalations and produce weekly summaries, and all high-risk write-like intents are routed through a governance pipeline (proposal capture, Gemini-based validation, approval gate, then commit) instead of direct mutation. Runtime behavior is orchestrated through time-based triggers and wrapper controllers with schema-aware repository access, while audit logging and status dashboards provide operational traceability across onboarding, training, and compliance flows.
