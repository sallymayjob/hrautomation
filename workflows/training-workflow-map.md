# Slack Workflow Builder Map — Training Operations (Google Sheets-backed)

This map defines the Slack Workflow Builder / Workflow Apps flows for:

1. Add a new course
2. Add a new module
3. Enroll a new learner to an existing course (course selected from Google Sheets)

All workflows use Google Sheets as the system of record (`Courses`, `Modules`, and `Learners` tabs).

---

## Architecture summary

```text
Slack Trigger (link trigger, shortcut, or slash command)
  -> (Optional) permissions guard / requester capture
  -> Google Sheets: Lookup rows (for dropdown source data)
  -> Form step (admin input)
  -> Google Sheets: Add row / Update row
  -> Confirmation message + audit log row
```

> Preferred trigger mode: **Link trigger** or **Workflow button/shortcut** for low-friction operations. Slash commands can be added for power users and to preserve discoverability.

---

## Workflow 1 — Add New Course

### Trigger
- `Link trigger`: `Start Add Course`
- Optional slash command: `/training-add-course`

### Steps
1. **Collect admin input (Form):**
   - Course ID (short text, required; e.g., `COURSE_06M`)
   - Course title (short text, required)
   - Description (long text)
   - Difficulty range (dropdown: Beginner, Intermediate, Advanced, Guided-Strategic)
   - Total months (number)
   - Status (dropdown: Draft, Active, Archived)
2. **Write to Google Sheets (`Courses` tab):** add row.
3. **Write to Google Sheets (`Audit_Log` tab):** add operation record.
4. **Send confirmation message** to requester.

### Google Sheets mapping (`Courses`)
- `CourseID` <- Course ID
- `Course Title` <- Course title
- `Description` <- Description
- `Difficulty Range` <- Difficulty range
- `Total Months` <- Total months
- `Status` <- Status
- `Last Updated` <- Current timestamp

---

## Workflow 2 — Add New Module

### Trigger
- `Link trigger`: `Start Add Module`
- Optional slash command: `/training-add-module`

### Steps
1. **Lookup existing courses (Google Sheets: `Courses`):** fetch `CourseID`, `Course Title`, `Status=Active`.
2. **Collect admin input (Form):**
   - Module ID (short text, required; e.g., `M13`)
   - Module number (number, required)
   - Module name (short text, required)
   - Module description (long text)
   - **Parent course** (dropdown sourced from step 1: `CourseID - Course Title`)
   - Difficulty tier (dropdown)
   - Audience (short text)
   - Status (dropdown: Draft, Active, Archived)
3. **Write to Google Sheets (`Modules` tab):** add row.
4. **Update Google Sheets (`Courses` tab):** append module ID into `Modules` list for selected course.
5. **Write `Audit_Log` row** + confirmation message.

### Google Sheets mapping (`Modules`)
- `ModuleID` <- Module ID
- `Module Number` <- Module number
- `Module Name` <- Module name
- `Module Description` <- Module description
- `CourseID` <- Parsed ID from selected parent course
- `Course Title` <- Parsed title from selected parent course
- `Status` <- Status
- `Difficulty Tier` <- Difficulty tier
- `Audience` <- Audience

---

## Workflow 3 — Enroll New Learner to Existing Course

### Trigger
- `Link trigger`: `Start Enroll Learner`
- Optional slash command: `/training-enroll`

### Steps
1. **Lookup existing active courses (Google Sheets: `Courses`):**
   - Return list for dropdown options (`CourseID - Course Title`).
2. **Collect enrollment details (Form):**
   - Learner (Slack person; required)
   - Learner email (email; required)
   - Employee ID (short text; optional)
   - **Course** (dropdown sourced from step 1)
   - Enrollment date (date, default today)
   - Start module (dropdown; default first module)
   - Notes (long text)
3. **Write learner enrollment row (`Learners` tab):** add row.
4. **Write assignment row (`Queue` or assignment tab):** optional initial lesson/module assignment.
5. **Write `Audit_Log` row**.
6. **Send confirmation DM** to requester and learner.

### Google Sheets mapping (`Learners`)
- `Learner` <- Slack user ID
- `Learner Email` <- Learner email
- `Employee ID` <- Employee ID
- `CourseID` <- Parsed ID from selected course
- `Course Title` <- Parsed title from selected course
- `Enrollment Date` <- Enrollment date
- `Status` <- `Active`
- `Notes` <- Notes

---

## Dynamic dropdown strategy for course selection

Use this pattern in Workflow Builder / Workflow Apps:

1. **Google Sheets lookup step** first (read active courses).
2. Transform rows into an options array (`label`, `value`) using either:
   - Native Workflow Builder variable mapping (if available in your Slack plan), or
   - A Workflow App custom step/function that outputs structured options.
3. Bind the options array to the form field for **Course**.

If native dynamic dropdown binding is unavailable in your workspace plan, implement course selection as:
- Step A: choose from text autocomplete (`CourseID`), then
- Step B: validate ID against `Courses` sheet and fail fast with a friendly message if invalid.

---

## OAuth, token, and app configuration requirements

### Slack tokens used
- **Bot token (`xoxb-...`)**: required for slash commands, confirmations, and workflow notifications.
- **Workflow execution token (`xwfp-...` issued by Slack runtime, if using custom workflow steps/functions)**: used only at runtime for Workflow Apps steps.

### Google authorization
- Authorize Google Sheets connector in Workflow Builder with a team-owned Google identity.
- Ensure that identity has read/write access to `Courses`, `Modules`, `Learners`, and `Audit_Log` tabs.

### Required Slack OAuth scopes (bot)
- `commands`
- `chat:write`
- `chat:write.public`
- `users:read`
- `users:read.email`
- `channels:read`
- `groups:read`
- `im:read`
- `mpim:read`
- `triggers:read`
- `triggers:write`
- `workflow.steps:execute`
- `workflow.steps:manage`

### Operational safeguards
- Add idempotency key per submission (`requester + ts + entity_id`) in `Audit_Log`.
- Validate uniqueness of `CourseID` and `ModuleID` before insert.
- Restrict triggers to HR/L&D admin user group where possible.
