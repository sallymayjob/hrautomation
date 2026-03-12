# RWR-HAF Deployment Guide


## Slack read-only guardrail (important)
Slack slash commands and interactive message responses in this project are **read-only** verification tools.
- Use Slack to check onboarding status and task progress.
- Edit onboarding/checklist/training statuses directly in Google Sheets.
- Do not configure or rely on Slack buttons to write status changes.

This guide helps you set up RWR-HAF without coding.
Follow each step in order.

Architecture reference: before deployment changes, review `docs/architecture-dataflow.md` for source/derived sheet flow, ownership boundaries, and fail-closed schema behavior.

## Phase 1 — Create the three spreadsheets (about 10 minutes)
This phase creates three online spreadsheets for your records.
A Google Sheet is an online spreadsheet, like Excel in your web browser.

1. Open `sheets.google.com` in your web browser.
2. Sign in with your RWR Group Google account.
3. Click the large coloured plus button.
4. Click the words "Untitled spreadsheet" at the top left.
5. Type `Onboarding`.
6. Press Enter.
7. Copy the long ID from the address bar.
What just happened? You saved the Onboarding sheet address the system needs later.
8. Save that ID in a safe note.
9. Click the large coloured plus button again.
10. Name the new sheet `Training Log`.
11. Copy its ID from the address bar.
What just happened? You saved the Training Log sheet address for later setup.
12. Save that ID in your note.
13. Click the large coloured plus button again.
14. Name the new sheet `Audit Log`.
15. Copy its ID from the address bar.
What just happened? You saved the Audit Log sheet address for later setup.
16. Save that ID in your note.

The ID is like a street address for each spreadsheet.
The system uses that address to find the right sheet.

17. Open the Onboarding spreadsheet.
18. Click File.
19. Click Import.
20. Click Upload.
21. Choose `sheets/onboarding.csv` from the provided files.
22. Click Import data.
What just happened? The column headings were created automatically.
23. Open the Training Log spreadsheet.
24. Click File.
25. Click Import.
26. Click Upload.
27. Choose `sheets/training-log.csv` from the provided files.
28. Click Import data.
What just happened? The Training Log headings were created automatically.
29. Open the Audit Log spreadsheet.
30. Click File.
31. Click Import.
32. Click Upload.
33. Choose `sheets/audit-log.csv` from the provided files.
34. Click Import data.
What just happened? The Audit Log headings were created automatically.

You're done with Phase 1. You now have three spreadsheets ready to use.

## Phase 2 — Create the Slack bot app (about 15 minutes)
This phase creates your bot helper in Slack.
A Slack app is a helper account inside Slack, not a real person.

1. Open `api.slack.com/apps` in your web browser.
2. Click the green "Create New App" button.
3. Click "From a manifest".
4. Choose your RWR Group workspace from the dropdown list.
5. Click Next.
6. Delete all text in the large text box.
7. Open `workflows/manifest.json` in Notepad or TextEdit.
8. Select all text in that file.
9. Copy the selected text.
10. Paste the text into Slack's large text box.
11. Click Next.
12. Check for `chat:write` in the permissions list.
13. Check for `chat:write.public` in the permissions list.
14. Check for `users:read` in the permissions list.
15. Check for `users:read.email` in the permissions list.
16. Stop and contact the tech lead if extra permissions appear.
17. Click Create.
What just happened? Slack created your bot app from a prepared settings file.
18. Click "Install to Workspace".
19. Click Allow.
What just happened? The app now has permission to work in your Slack workspace.
20. Find the "Bot User OAuth Token" section.
21. Click Copy on the token that starts with `xoxb-`.
22. Save this token in your secure note.
What just happened? You saved the bot password needed by the system.

You're done with Phase 2. Your Slack bot app exists and is installed in your workspace.

## Phase 2.5 — Set up required Slack channels (about 10 minutes)
Before continuing, set up and validate the required Slack channels.

1. Open `docs/slack-channels-guide.md`.
2. Create all required channels with exact names.
3. Invite `@New Hire Intake Bot` to required channels.
4. Copy and save channel IDs for deployment.

What just happened? You prepared the channel destinations the automation needs for alerts, approvals, workflow triggers, and recognition posts.

You're done with Phase 2.5. Required Slack channels are now ready.

## Phase 3 — Give the system its passwords and IDs (about 20 minutes)
This phase stores all important IDs and passwords safely.
Google Apps Script is a Google control room that runs this automation.
Think of it like a locked office drawer for system settings.
Need extra help? Read `docs/google-apps-script-eli15-guide.md` for a beginner-friendly walkthrough.

### Find your Slack channel IDs
Every channel has an ID, like a name badge number.
The ID looks like `C01234ABCDE`.

Tip: If channels are not set up yet, complete **Phase 2.5** first.

1. Open Slack.
2. Right-click `#hr-ops-alerts` in the left sidebar.
3. Click "Open channel details" or "View channel details".
4. Scroll to the bottom of the details panel.
5. Copy the channel ID.
6. Save that ID in your secure note.
What just happened? You saved the alerts channel address.
7. Repeat steps 2 to 6 for `#hr-approvals`.
8. Repeat steps 2 to 6 for `#general`.

### Open the Google Apps Script control room
1. Open your Onboarding spreadsheet.
2. Click Extensions in the top menu.
3. Click Apps Script.
What just happened? A new browser tab opened with your automation control room.
4. Click the gear icon at the top left.
5. Scroll to the "Script Properties" section.
6. Click "Add script property".

### Add each setting
Type each property name exactly.
Capital letters and underscores must match exactly.
If one name is wrong, the system can fail.

1. Add `SLACK_BOT_TOKEN`.
2. Paste the `xoxb-` token as its value.
3. Add `HR_ALERTS_CHANNEL_ID`.
4. Paste the `#hr-ops-alerts` channel ID.
5. Add `HR_APPROVALS_CHANNEL_ID`.
6. Paste the `#hr-approvals` channel ID.
7. Add `GENERAL_CHANNEL_ID`.
8. Paste the `#general` channel ID.
9. Add `ONBOARDING_SPREADSHEET_ID`.
10. Paste the Onboarding spreadsheet ID.
11. Add `TRAINING_SPREADSHEET_ID`.
12. Paste the Training Log spreadsheet ID.
13. Add `AUDIT_SPREADSHEET_ID`.
14. Paste the Audit Log spreadsheet ID.
15. Add `CHECKLIST_SPREADSHEET_ID`.
16. Paste the Checklist spreadsheet ID (standalone checklist workbook).
17. Add `ONBOARDING_SHEET_NAME`.
18. Set value to the onboarding tab name (for example `Onboarding`).
19. Add `TRAINING_SHEET_NAME`.
20. Set value to the training tab name (for example `Training Log`).
21. Add `AUDIT_SHEET_NAME`.
22. Set value to the audit tab name (for example `Audit Log`).
23. Add `CHECKLIST_SHEET_NAME`.
24. Set value to the checklist tab name (for example `Checklist Tasks`).
25. Add `ADMIN_FALLBACK_EMAIL`.
26. Paste the HR admin email, for example `hr@rwrgroup.com`.
27. Add `ENV`.
28. Type `production` as the value.
29. Add `ADMIN_TEAM_CHANNEL_ID`.
30. Add `FINANCE_TEAM_CHANNEL_ID`.
31. Add `HR_TEAM_CHANNEL_ID`.
32. Add `IT_TEAM_CHANNEL_ID`.
33. Add `LEGAL_TEAM_CHANNEL_ID`.
34. Add `OPERATIONS_TEAM_CHANNEL_ID`.
35. Add `PEOPLE_TEAM_CHANNEL_ID`.
36. Add `DEFAULT_ASSIGNMENTS_CHANNEL_ID`.
37. Paste the Slack channel IDs for each destination.
38. Click "Save script properties".
What just happened? The system now knows every address and password it needs, including checklist assignment destinations.

You're done with Phase 3. The system now knows where everything lives.

## Phase 3.5 — Load the Apps Script code from GitHub (about 15 minutes)
This phase copies the prepared automation code into your Apps Script project.
GitHub is where the tech lead stores the official source files.

### Start from the GitHub link
1. Ask the tech lead for the GitHub repository link for this automation.
2. Copy that link.
3. Paste the link into your web browser and press Enter.
4. In GitHub, open the `gas` folder.
What just happened? You are now looking at the exact script files that must be copied into Google Apps Script.

### Copy each file into Apps Script
1. Return to your Apps Script tab (opened in Phase 3).
2. In the left file panel, click each existing file and delete starter code if present.
3. In GitHub, open `gas/Code.gs`.
4. Click the pencil icon or click **Raw**.
5. Select all text, then copy it.
6. In Apps Script, open `Code.gs` and paste the copied text.
7. Click Save.
8. Repeat steps 3 to 7 for every file in the `gas` folder:
   - `Approvals.gs`
   - `BlockKit.gs`
   - `ChecklistTemplate.gs`
   - `Commands.gs`
   - `Config.gs`
   - `Recognition.gs`
   - `Reminders.gs`
   - `Reporting.gs`
   - `SheetClient.gs`
   - `SlackClient.gs`
   - `Triggers.gs`
   - `Utils.gs`
9. In GitHub, open `gas/appsscript.json` and copy its content.
10. In Apps Script, click Project Settings, enable "Show appsscript.json manifest file in editor" if needed, then paste the copied JSON into `appsscript.json`.
11. Click Save.
What just happened? Your Apps Script project now contains the same trusted code as GitHub.

### How this works
- The `Code.gs` and helper files hold onboarding, reminders, and notification logic.
- `SlackClient.gs` and `BlockKit.gs` build and send Slack messages.
- `SheetClient.gs` reads and writes your Google Sheets.
- `Commands.gs` handles incoming Slack slash commands (for example `/onboarding-status`) with read-only lookups.
- `Triggers.gs` creates the daily schedule jobs you activate in Phase 5.
- `appsscript.json` sets project-level configuration.

You're done with Phase 3.5. The Apps Script code is now loaded and ready to run.

## Phase 3.6 — Add the onboarding status slash command (about 10 minutes)
This phase connects a read-only Slack command to your Apps Script web app.

1. In Apps Script, click **Deploy** > **New deployment**.
2. Choose type **Web app**.
3. Set **Execute as** to your deployment owner account.
4. Set **Who has access** to `Anyone` (or `Anyone in workspace` if Slack can reach it).
5. Click **Deploy** and copy the Web app URL (it ends with `/exec`).
6. Open your Slack app settings at `api.slack.com/apps`.
7. Click **Slash Commands** in the left menu.
8. Click **Create New Command**.
9. In **Command**, enter `/onboarding-status`.
10. In **Request URL**, paste the Apps Script Web app URL from step 5.
11. In **Short Description**, enter `Read-only onboarding status lookup`.
12. In **Usage Hint**, enter `<new hire name>`.
13. Click **Save**.
14. Reinstall or update the app in your workspace if Slack prompts you.

What just happened? Slack can now send `/onboarding-status` queries to Apps Script, and the script returns onboarding summaries without editing records. Status updates remain Sheets-only (read-only in Slack).

You're done with Phase 3.6. The slash command path is live for status checks.

## Phase 4 — Connect Slack Workflow Builder to the spreadsheet (about 20 minutes)
This phase connects Slack's form tool to your Onboarding spreadsheet.
Workflow Builder is Slack's no-code process tool.
Think of it like setting automatic rules in your email inbox.

1. Open Slack.
2. Click the lightning bolt icon near the message box.
3. Click Workflow Builder.
What just happened? A setup window opened for automated Slack workflows.
Tip: Open `docs/setup-list.md` in a second window so you can copy the exact dropdown options.
4. Click "Create Workflow".
5. Click "Start from scratch".
6. Type `New Hire Onboarding Intake` as the workflow name.
7. Click Next.
8. Click "When a person joins a channel".
9. Click Next.
10. Select `#new-hires` from the dropdown list.
11. Click Save.

### Add HR notification message step (required before form)
12. Click the blue `+` button.
13. Click `Direct Message`.
14. Choose the HR approver recipient (the person or group that monitors approvals).
15. In the message text, write a notification such as:
   `A new hire has joined #new-hires. Click Continue Workflow to start onboarding intake.`
16. Confirm the message includes the `Continue Workflow` button.
17. Click Save.
What just happened? HR approvers now receive a direct message notification and can start intake from the button.

### Add the form step
18. Click the blue `+` button.
19. Click "Collect information in a form".
20. Click "Add a question".
21. Enter `New Employee Name`.
22. Choose `Multiple Slack users`.
23. Mark it as required.
24. Optional: add hint `Tag the new starter(s) so Slack can pass their user ID(s).`.
25. Click "Add a question".
26. Enter `Role`.
27. Choose `Select from a list`.
28. Add role options from `docs/setup-list.md`.
29. Mark it as required.
30. Click "Add a question".
31. Enter `Brand`.
32. Choose `Select from a list`.
33. Add brand options from `docs/setup-list.md`.
34. Mark it as required.
35. Click "Add a question".
36. Enter `Region`.
37. Choose `Select from a list`.
38. Add region options from `docs/setup-list.md`.
39. Mark it as required.
40. Click "Add a question".
41. Enter `Start Date`.
42. Choose `Date`.
43. Mark it as required.
44. Click "Add a question".
45. Enter `Date of Birth`.
46. Choose `Date`.
47. Mark it as required.
48. Click "Add a question".
49. Enter `Buddy Email`.
50. Choose `Slack person` (single Slack user).
51. Mark it as required.
52. Click "Add a question".
53. Enter `Manager Email`.
54. Choose `Slack person` (single Slack user).
55. Mark it as required.
56. Click Save.
What just happened? Slack now has a full intake form for each new hire, including a required buddy (peer) and manager (trainer).

### Add the spreadsheet step
57. Click the blue `+` button.
58. Click Google Sheets.
59. Click "Add a spreadsheet row".
60. Click Connect if account access is requested.
61. Sign in with your RWR Group Google account.
62. Select the Onboarding spreadsheet.
63. Select `Sheet1` or `Onboarding` as the tab.
64. Leave `onboarding_id` blank so Apps Script auto-generates it.
65. Map `employee_name` to `New Employee Name` (display name).
66. Map `slack_id` to `New Employee Name` → user ID token (not trigger person).
67. Leave `email` blank.
68. Map `role` to `Role`.
69. Map `brand` to `Brand`.
70. Map `start_date` to `Start Date`.
71. Map `region` to `Region`.
72. Map `buddy_email` to `Buddy Email` → email token (from selected Slack user).
73. Map `manager_email` to `Manager Email` → email token (from selected Slack user).
74. Map `dob` to `Date of Birth`.
75. Set `status` to `PENDING`.
76. Click Save.
77. Click Publish at the top right.
78. Click Publish again to confirm.
What just happened? New hire form answers now save directly into your Onboarding sheet, with onboarding IDs generated automatically by the automation script.

You're done with Phase 4. Slack will now collect new hire details automatically.

## Phase 5 — Switch on the daily automatic checks (about 10 minutes)
This phase turns on daily reminders and celebration checks.
You do this once, then it runs every day.

How this works: pressing Run on a setup function creates a time-based trigger in Apps Script.
That trigger tells Google to run your checks automatically every morning at 8:00 AM NZ time.

1. Return to your Apps Script tab.
2. Click the "Select function" dropdown.
3. Choose `setupDailyTrigger`.
4. Click the play button.
5. Click "Review permissions" if asked.
6. Choose your Google account.
7. Click Allow.
8. Wait 10 seconds.
9. Confirm you see "Execution completed" at the bottom.
What just happened? Daily reminder checks are now scheduled.
10. Click the "Select function" dropdown again.
11. Choose `setupBirthdayTrigger`.
12. Click the play button.
13. Wait 10 seconds.
14. Confirm you see "Execution completed" again.
What just happened? Birthday and anniversary checks are now scheduled.

You're done with Phase 5. The system will run each morning at 8:00 AM NZ time.

## Testing the system (about 10 minutes)
Run this test before real onboarding starts.

1. Ask a colleague to join `#new-hires` temporarily.
2. Fill in the workflow form with test details.
3. Choose `NZ` for Region.
4. Wait up to 2 minutes.
5. Open the Onboarding spreadsheet.
6. Check that a new row appeared.
7. Check that `onboarding_id` was auto-generated.
8. Check that both `buddy_email` and `manager_email` were captured.
9. Check that `status` changed to `IN_PROGRESS`.
10. Ask the colleague to check direct messages in Slack.
11. Confirm they received a welcome message from RWR HR Bot.
12. Open the Audit Log spreadsheet.
13. Confirm today's row includes an onboarding update event and no `BLOCKED` reason.
What just happened? You confirmed form capture, welcome message, and logging all work.

If any check fails, take a screenshot and send it to the tech lead.

Testing complete. If all three checks passed, the system is ready for real use.


## Onboarding completion gate logic
- Valid onboarding statuses are `PENDING`, `IN_PROGRESS`, `BLOCKED`, `COMPLETE`.
- The system generates checklist tasks with explicit phases (`Documentation`, `Pre-onboarding`, `Day-1 readiness`).
- All generated checklist tasks are treated as required before onboarding can move to `COMPLETE`.
- If an operator attempts to complete onboarding early, the gate writes `BLOCKED` and a detailed `blocked_reason` grouped by phase.
- Typical blocked reasons include missing contract completion and missing Google account test verification.

### Operator actions for blocked onboarding
1. Open the Onboarding row and copy the `blocked_reason` text.
2. Resolve each required task in the named phase(s).
3. Update corresponding Checklist Tasks rows to `COMPLETE`.
4. Set onboarding status to `COMPLETE` again.
5. Confirm `blocked_reason` is cleared.


## Manual checklist status updates (operations)
- Checklist tasks live in a standalone workbook configured by `CHECKLIST_SPREADSHEET_ID` + `CHECKLIST_SHEET_NAME`.
- Operations teams may manually edit only these columns when intervening: `status`, `updated_at`, `updated_by`, and `notes`.
- Generator reruns overwrite template-controlled fields (`phase`, `task_name`, `owner_team`, `owner_slack_channel`, `due_date`) but preserve the manual status fields above.
- When resolving a blocked onboarding, update checklist `status` to `COMPLETE`/`DONE`, set `updated_at` to now, and set `updated_by` to your email or handle.

## What happens every day (no action needed)
- At 8:00 AM NZ time, training deadlines are checked for reminders.
- Anyone due in 3 days receives a reminder message.
- Anyone due today receives a reminder message.
- Anyone overdue by 3 days receives a final reminder.
- Their manager also receives an overdue notice.
- At 8:00 AM NZ time, birthdays and anniversaries are checked.
- Matching employees receive automatic celebration messages.
- When training is marked complete, a celebration posts to `#general` automatically.

You're done with this part.

## Keeping the system healthy (monthly, about 5 minutes)
- [ ] Open Audit Log and check new rows exist for this month.
- [ ] Contact the tech lead if the newest row is older than 3 days.
- [ ] Open Onboarding and check for rows with `BLOCKED` status.
- [ ] Send failed employee names to the tech lead.
- [ ] Tell the tech lead if training links changed.
- [ ] Do not edit training links yourself.

You're done with this part.

## If something goes wrong

### A new hire did not get a welcome message
- Check their row in the Onboarding spreadsheet.
- If status is `PENDING`, wait 5 minutes.
- If still `PENDING`, contact the tech lead.
- If status is `BLOCKED`, read `blocked_reason`, resolve missing tasks (for example signed contract or Google account test), then set status back to `IN_PROGRESS`.
- If status is `IN_PROGRESS`, ask the new hire to check direct messages and verify checklist task progress.
- Set status to `COMPLETE` only after required checklist phases (`Documentation`, `Pre-onboarding`, `Day-1 readiness`) are complete.
- If no row exists, ask the manager to add details manually.
- Contact the tech lead for the correct row template.

### The bot is posting to the wrong channel
- Stop making changes.
- Take a screenshot of the wrong message.
- Contact the tech lead immediately.
- Share the screenshot with your message.

### The Audit Log has not updated for more than 3 days
- Contact the tech lead.
- Tell them daily triggers may be off.

You're done with this part.

*RWR Group · Confidential · RWR-HAF v1.1*
