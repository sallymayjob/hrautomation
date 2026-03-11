# Google Apps Script (GAS) Guide — Zero Tech Background (ELI15)

This guide explains Google Apps Script in plain language.
If you can copy/paste text and click Save, you can do this.

## What is Google Apps Script?
Google Apps Script is like a robot helper for Google Sheets.
You give the robot instructions once.
Then it does repeat jobs for you automatically.

In this project, GAS does things like:
- read onboarding rows from your sheet,
- send Slack messages,
- run daily reminder checks,
- post celebration messages.

Think of it like:
- **Google Sheet** = your notebook,
- **Apps Script** = your assistant,
- **Triggers** = alarm clocks that tell the assistant when to work.

---

## Big picture: how your setup works
1. Slack form writes a new person into the Onboarding sheet.
2. Apps Script reads that row.
3. Apps Script sends welcome + assignment messages.
4. Apps Script creates follow-up tasks.
5. Daily triggers run every morning and send reminders.

You set this up once. After that, it runs in the background.

---

## What you need before you start
- A Google account (correct work account).
- Access to the Onboarding Google Sheet.
- The GitHub repository link from the tech lead.
- A safe note where you store IDs/tokens.

If any of these are missing, stop and ask the tech lead first.

---

## Step-by-step: open Apps Script
1. Open your **Onboarding** Google Sheet.
2. Click **Extensions** in the top menu.
3. Click **Apps Script**.
4. A new tab opens (this is the script editor).

What just happened?
You opened the control room where automation code lives.

---

## Step-by-step: copy code from GitHub into Apps Script
1. Open the GitHub link from your tech lead.
2. Open the `gas` folder.
3. Open `Code.gs`.
4. Click **Raw** (or edit view), then copy all text.
5. Go back to Apps Script, open `Code.gs`, paste text, click **Save**.
6. Repeat for all `.gs` files in `gas/`.
7. Open `gas/appsscript.json` in GitHub, copy it.
8. In Apps Script, open **Project Settings**.
9. Turn on: **Show "appsscript.json" manifest file in editor**.
10. Open `appsscript.json`, paste text, click **Save**.

What just happened?
Your Apps Script project now has the official automation code.

---

## Step-by-step: add Script Properties (secret settings)
Script Properties are locked settings (like saved passwords/IDs).

1. In Apps Script, click the gear icon (**Project Settings**).
2. Find **Script Properties**.
3. Add each key and value exactly as provided.
4. Click **Save script properties**.

Important:
- Names must match exactly (capital letters matter).
- Never share tokens in Slack chats.

---

## Step-by-step: run setup functions once
You need to run setup functions one time to create daily trigger alarms.

1. In Apps Script top bar, use **Select function**.
2. Choose `setupDailyTrigger`.
3. Click **Run** (play button).
4. Approve permissions if prompted.
5. Wait for **Execution completed**.
6. Repeat with `setupBirthdayTrigger`.

What just happened?
You created daily alarms so checks run automatically each morning.

---

## How to know it is working
Check these signs:
- New onboarding rows move from `PENDING` to `IN_PROGRESS`.
- Welcome/assignment messages appear in Slack.
- Audit Log gets new rows.
- Apps Script **Executions** panel shows successful runs.

If all 4 are true, your automation is healthy.

---

## Quick troubleshooting (non-technical)
### Problem: "Execution failed"
- Open the latest run in **Executions**.
- Copy the error line.
- Send that screenshot + error text to tech lead.

### Problem: No Slack messages sent
- Check Script Properties are saved correctly.
- Confirm bot token starts with `xoxb-`.
- Confirm channel IDs are correct.

### Problem: Daily checks stopped
- Open Apps Script → **Triggers**.
- Confirm daily triggers exist.
- If missing, run `setupDailyTrigger` and `setupBirthdayTrigger` again.

---

## Safety rules
- Do not rename columns in production sheets unless approved.
- Do not edit code you don’t understand.
- Do not delete triggers unless instructed.
- Do not share tokens in email/chat.

When unsure: stop, screenshot, ask tech lead.

---

## Words explained (mini glossary)
- **GAS / Apps Script:** Google’s automation tool.
- **Trigger:** Automatic schedule to run a function.
- **Function:** A named action (example: `setupDailyTrigger`).
- **Script Properties:** Secure project settings (IDs/tokens).
- **Manifest (`appsscript.json`):** Project config file.
- **Execution log:** History of runs + errors.

---

## 60-second recap
- Apps Script is your sheet automation helper.
- Copy official code from GitHub into Apps Script.
- Add Script Properties correctly.
- Run trigger setup functions once.
- Check Executions + Audit Log to confirm health.

That’s it — you don’t need to code daily to use this system.
