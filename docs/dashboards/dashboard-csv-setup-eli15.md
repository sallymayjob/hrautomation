# Dashboard CSV Templates + Setup Guide (Zero Tech / ELI15)

This guide is written for non-technical users.
You can set this up with copy/paste + clicks only.

---

## 0) System layout (important): 3 separate spreadsheets

Use **three different Google Sheets files**:

1. **Onboarding Spreadsheet** (contains onboarding + checklist + onboarding dashboard)
   - Raw tabs: `Onboarding`, `Checklist`
   - Dashboard tabs: `Onboarding_KPI`, `Onboarding_Status`, `Onboarding_Department`
   - Purpose: Track each employee onboarding status, what is missing, and department progress (Finance/Manager/IT/etc).

2. **Training Spreadsheet** (contains LMS tabs + training dashboard)
   - Raw tabs: `Learners`, `Lesson Submissions`, `Queue`, `Lesson QA Records`, `Courses`, `Lesson Metrics`, `Modules`, `Lessons`, `Slack Threads`, `Audit_Log`
   - Dashboard tabs: `Training_KPI`, `Training_Module`, `Training_Course`, `Training_Operations`
   - Purpose: LMS analytics + operational monitoring (progress, gaps, submissions, queue load, and automation telemetry summarized in `Audit_Log`).

3. **Audit Spreadsheet** (contains canonical runtime audit ledger + audit dashboard)
   - Raw tab: `Audit`
   - Dashboard tabs: `Audit_Dashboard`, `Audit_KPI`, `Audit_Pivot`
   - Purpose: immutable policy/compliance and exception ledger used as the system audit source of truth.

> **Important:** The project's canonical runtime audit ledger is the dedicated `Audit` tab in the separate audit workbook (schema in `sheets/audit-schema.json`, fixture in `sheets/audit-log.csv`).
> `Audit_Log` in the training workbook is dashboard/operations telemetry only (`sheets/training-tabs/training-operations-log.csv`) and is **not** the compliance ledger of record.

---

## 1) Upload raw CSV files to the correct spreadsheet

### A) Onboarding Spreadsheet imports
- `sheets/onboarding.csv` -> tab name `Onboarding`
- `sheets/checklist.csv` -> tab name `Checklist`

### B) Training Spreadsheet imports
- `sheets/training.csv` -> tab name `Learners`
- `sheets/training-tabs/lesson-submissions.csv` -> tab name `Lesson Submissions`
- `sheets/training-tabs/queue.csv` -> tab name `Queue`
- `sheets/training-tabs/lesson-qa-records.csv` -> tab name `Lesson QA Records`
- `sheets/training-tabs/courses.csv` -> tab name `Courses`
- `sheets/training-tabs/lesson-metrics.csv` -> tab name `Lesson Metrics`
- `sheets/training-tabs/modules.csv` -> tab name `Modules`
- `sheets/training-tabs/lessons.csv` -> tab name `Lessons`
- `sheets/training-tabs/slack-threads.csv` -> tab name `Slack Threads`
- `sheets/training-tabs/training-operations-log.csv` -> tab name `Audit_Log` (**non-runtime dashboard fixture**)

> These tab names match your provided training sheet tabs.

### Zero-tech upload steps (same for every file)
1. Open the correct spreadsheet (Onboarding OR Training).
2. Click `File > Import > Upload`.
3. Select the CSV file.
4. Set options:
   - **Import location**: `Insert new sheet(s)`
   - **Separator type**: `Detect automatically`
   - **Convert text to numbers, dates, and formulas**: enabled
5. Click `Import data`.
6. Rename tab exactly as listed above.

### Quick checks after import
- Header row is row 1.
- Data is spread across columns (not all in column A).
- Dates look like real dates.
- Tab names are exact (capital letters matter).

---

## 2) Onboarding dashboard (same spreadsheet as Onboarding + Checklist)

This dashboard answers:
- Which employee is complete vs pending vs blocked?
- What is still missing per person?
- How many checklist items are done/pending per department (Finance, Manager, IT, etc)?

### `Onboarding_KPI.csv`
```csv
kpi_name,kpi_value,definition,refresh_notes
active_onboarding_count,0,"Employees where status is PENDING/IN_PROGRESS/BLOCKED","Refresh daily"
completed_onboarding_count,0,"Employees where status is COMPLETE","Refresh daily"
blocked_onboarding_count,0,"Employees where status is BLOCKED","Refresh daily"
checklist_completion_rate,0,"Completed checklist tasks / total checklist tasks","Refresh daily"
overdue_task_count,0,"Checklist tasks due before today and not complete","Refresh daily"
```

### `Onboarding_Status.csv` (per employee status + missing items)
```csv
onboarding_id,employee_name,status,checklist_tasks_total,checklist_tasks_done,checklist_tasks_pending,missing_or_blocked_items,manager_email
OB-20260303-a1b2,Amelia Thompson,IN_PROGRESS,8,6,2,"Awaiting finance form + IT access",olivia.carter@rwrgroup.co.nz
OB-20260310-b7c8,Hayley McKenzie,BLOCKED,7,3,4,"Missing contract signature + Google account test",
OB-20260306-d9e0,Wiremu Rangi,BLOCKED,6,2,4,"Manager email missing + onboarding processing error",isla.patel@rwrgroup.co.nz
```

### `Onboarding_Department.csv` (department completion and pending)
```csv
department,tasks_total,tasks_completed,tasks_pending,tasks_overdue,completion_pct
Finance,12,9,3,1,75
Manager,10,6,4,2,60
IT,11,8,3,1,73
People_Culture,7,6,1,0,86
Compliance,5,4,1,0,80
```

---

## 3) Training dashboard (separate Training spreadsheet)

This dashboard answers:
- How many employees are taking each lesson/module/course?
- What is complete, in progress, overdue, or still assigned?
- Where are the training gaps for onboarded employees?
- Are there any operations issues from `Audit_Log` dashboard summaries (automation failures)?

### `Training_KPI.csv`
```csv
kpi_name,kpi_value,definition,refresh_notes
assigned_training_count,0,"Total assigned lessons/modules/courses","Refresh daily"
completed_training_count,0,"Rows where status is COMPLETE","Refresh daily"
in_progress_training_count,0,"Rows where status is IN_PROGRESS/REMINDER_SENT","Refresh daily"
overdue_training_count,0,"Rows overdue and not complete","Refresh daily"
on_time_completion_rate,0,"Completed on/before due date / all completed","Refresh daily"
```

### `Training_Module.csv` (how many per lesson/module)
```csv
resource_code,resource_title,assigned_count,completed_count,in_progress_count,overdue_count
FOUND-W1,Foundations Week 1,20,14,4,2
FOUND-W2,Foundations Week 2,20,10,7,3
PROB-M2,Probity Module 2,12,5,5,2
FRANCH-PRE,Franchisee Preboarding Essentials,8,3,4,1
```

### `Training_Course.csv` (course-level analytics for admins)
```csv
course_name,total_enrolled,total_completed,total_pending,total_overdue,completion_pct
Foundations Program,40,24,11,5,60
Probity Program,12,5,5,2,42
Franchisee Preboarding,8,3,4,1,38
```

### `Training_Operations.csv` (from `Queue` + dashboard `Audit_Log`)
```csv
metric,value,definition
queue_pending_count,2,"Rows in Queue where QueueStatus is Pending"
queue_in_progress_count,1,"Rows in Queue where QueueStatus is In Progress"
automation_failed_last_24h,1,"Rows in Audit_Log where status is FAILED in last 24h"
critical_error_count,1,"Rows in Audit_Log where event_type is ERROR"
```

---

## 4) ELI15 setup flow (do this in order)

1. Create 3 Google spreadsheets:
   - `HR Onboarding Dashboard`
   - `HR Training Dashboard`
   - `HR Audit Dashboard`
2. Import raw CSVs into the correct spreadsheet (Section 1).
3. In each spreadsheet, create dashboard tabs listed in Sections 2 and 3, and in the audit spreadsheet create `Audit_Dashboard`, `Audit_KPI`, and `Audit_Pivot`.
4. Paste the matching CSV templates into each dashboard tab (`A1`).
5. Freeze header row and apply simple colors:
   - Green = complete/success
   - Yellow = in progress/pending
   - Red = blocked/failed/critical
6. Review once daily (or automate refresh with Apps Script trigger).

---

## 5) Simple recap
- **Onboarding spreadsheet** = onboarding + checklist + onboarding dashboard.
- **Training spreadsheet** = learners/LMS tabs + training dashboard + operations view.
- **Audit spreadsheet** = canonical `Audit` ledger (append-only system record) + audit dashboards.
- **Dashboard operations log**: use Training `Audit_Log` only for analytics/visualization telemetry fixtures.

Three spreadsheets, clear ownership boundaries, and cleaner reporting.
