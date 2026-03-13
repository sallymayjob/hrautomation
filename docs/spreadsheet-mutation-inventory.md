# Spreadsheet Mutation Inventory

This inventory was generated from:

- `rg -n "\.(setValue|setValues|appendRow|deleteRow|insert(Row|Rows|Column|Columns|Sheet|Sheets)|clear(Content|Contents|Format|Formats|DataValidations|Note|Notes)?|clear\()\b|SpreadsheetApp\.openById" gas`

## Tagged mutation points

| File | Write/API calls | Owning module | Business purpose |
| --- | --- | --- | --- |
| `gas/OnboardingRepository.gs` | `appendRow`, `setValue` | OnboardingRepository | Persist onboarding records and state transitions (`status`, `blocked_reason`, `last_updated_at`). |
| `gas/TrainingRepository.gs` | `setValue` | TrainingRepository | Update training lifecycle columns (`training_status`, reminder fields, celebration flags). |
| `gas/LessonRepository.gs` | `setValue` | LessonRepository | Persist lesson/checklist updates and reminder metadata (`updated_at`, `updated_by`). |
| `gas/AuditRepository.gs` | `appendRow` | AuditRepository | Append audit log events for workflow visibility and traceability. |
| `gas/WorkflowSheetRepository.gs` | `insertSheet`, `appendRow`, `clear`, `setValue` | WorkflowSheetRepository | Generic workflow-side writes for exception/handoff/ops dashboard tabs. |
| `gas/ReportingRepository.gs` | `clearContent`, `setValues` | ReportingRepository | Replace weekly reporting summary tab contents. |
| `gas/SheetClient.gs` | `openById`, `insertSheet`, `clear`, `appendRow`, `setValue`, `setValues` | SheetClient (infrastructure adapter used by repositories) | Shared low-level spreadsheet access and schema/header bootstrapping. |
| `gas/LibraryWrappers.gs` | `SpreadsheetApp.openById` + repository calls | LibraryWrappers orchestrator | Open target spreadsheet and delegate all row writes to `WorkflowSheetRepository`. |

## Refactor status

- Reporting summary writes were moved from `Reporting.gs` into `ReportingRepository.gs` so reporting orchestration now writes through repository methods only.
- Existing workflow wrapper writes already route through `WorkflowSheetRepository`.
- A test guard now fails if non-repository GAS modules introduce direct sheet mutation APIs.
