# RWR-HAF Deployment Guide

This guide helps you set up RWR-HAF without coding.
Follow each step in order.

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

## Phase 3 — Give the system its passwords and IDs (about 20 minutes)
This phase stores all important IDs and passwords safely.
Google Apps Script is a Google control room that runs this automation.
Think of it like a locked office drawer for system settings.

### Find your Slack channel IDs
Every channel has an ID, like a name badge number.
The ID looks like `C01234ABCDE`.

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
9. Add `ONBOARDING_SHEET_ID`.
10. Paste the Onboarding spreadsheet ID.
11. Add `TRAINING_SHEET_ID`.
12. Paste the Training Log spreadsheet ID.
13. Add `AUDIT_SHEET_ID`.
14. Paste the Audit Log spreadsheet ID.
15. Add `ADMIN_FALLBACK_EMAIL`.
16. Paste the HR admin email, for example `hr@rwrgroup.com`.
17. Add `ENV`.
18. Type `production` as the value.
19. Click "Save script properties".
What just happened? The system now knows every address and password it needs.

You're done with Phase 3. The system now knows where everything lives.

## Phase 4 — Connect Slack Workflow Builder to the spreadsheet (about 20 minutes)
This phase connects Slack's form tool to your Onboarding spreadsheet.
Workflow Builder is Slack's no-code process tool.
Think of it like setting automatic rules in your email inbox.

1. Open Slack.
2. Click the lightning bolt icon near the message box.
3. Click Workflow Builder.
What just happened? A setup window opened for automated Slack workflows.
4. Click "Create Workflow".
5. Click "Start from scratch".
6. Type `New Hire Onboarding Intake` as the workflow name.
7. Click Next.
8. Click "When a person joins a channel".
9. Click Next.
10. Select `#new-hires` from the dropdown list.
11. Click Save.

### Add the form step
12. Click the blue `+` button.
13. Click "Collect information in a form".
14. Click "Add a question".
15. Enter `New Employee Name`.
16. Choose `Short answer`.
17. Mark it as required.
18. Click "Add a question".
19. Enter `Role`.
20. Choose `Select from a list`.
21. Add role options from your setup list.
22. Mark it as required.
23. Click "Add a question".
24. Enter `Brand`.
25. Choose `Select from a list`.
26. Add brand options from your setup list.
27. Mark it as required.
28. Click "Add a question".
29. Enter `Region`.
30. Choose `Select from a list`.
31. Add `NZ` and `AU` as options.
32. Mark it as required.
33. Click "Add a question".
34. Enter `Start Date`.
35. Choose `Date`.
36. Mark it as required.
37. Click "Add a question".
38. Enter `Date of Birth`.
39. Choose `Date`.
40. Mark it as required.
41. Click "Add a question".
42. Enter `Manager Email`.
43. Choose `Short answer`.
44. Leave it as optional.
45. Click Save.
What just happened? Slack now has a full intake form for each new hire.

### Add the spreadsheet step
46. Click the blue `+` button.
47. Click Google Sheets.
48. Click "Add a spreadsheet row".
49. Click Connect if account access is requested.
50. Sign in with your RWR Group Google account.
51. Select the Onboarding spreadsheet.
52. Select `Sheet1` or `Onboarding` as the tab.
53. Map `employee_name` to `New Employee Name`.
54. Map `slack_id` to `Member ID` from the trigger person.
55. Leave `email` blank.
56. Map `role` to `Role`.
57. Map `brand` to `Brand`.
58. Map `start_date` to `Start Date`.
59. Map `region` to `Region`.
60. Map `manager_email` to `Manager Email`.
61. Map `dob` to `Date of Birth`.
62. Set `status` to `PENDING`.
63. Click Save.
64. Click Publish at the top right.
65. Click Publish again to confirm.
What just happened? New hire form answers now save directly into your Onboarding sheet.

You're done with Phase 4. Slack will now collect new hire details automatically.

## Phase 5 — Switch on the daily automatic checks (about 10 minutes)
This phase turns on daily reminders and celebration checks.
You do this once, then it runs every day.

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
7. Check that `status` changed to `DM_SENT`.
8. Ask the colleague to check direct messages in Slack.
9. Confirm they received a welcome message from RWR HR Bot.
10. Open the Audit Log spreadsheet.
11. Confirm today's row includes `DM_SENT` in `event_type`.
What just happened? You confirmed form capture, welcome message, and logging all work.

If any check fails, take a screenshot and send it to the tech lead.

Testing complete. If all three checks passed, the system is ready for real use.

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
- [ ] Open Onboarding and check for rows with `FAILED` status.
- [ ] Send failed employee names to the tech lead.
- [ ] Tell the tech lead if training links changed.
- [ ] Do not edit training links yourself.

You're done with this part.

## If something goes wrong

### A new hire did not get a welcome message
- Check their row in the Onboarding spreadsheet.
- If status is `PENDING`, wait 5 minutes.
- If still `PENDING`, contact the tech lead.
- If status is `FAILED`, contact the tech lead to reset and resend.
- If status is `DM_SENT`, ask the new hire to check direct messages.
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
