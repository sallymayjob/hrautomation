# SOP: Run Onboarding and Audit **now** (plain-language)

Use this when you need to run the workflow immediately (not wait for the schedule).

> Screenshot note: these images are example click maps so users know exactly where to click.

![Click path from Google Sheet menu: Extensions to Apps Script](./assets/sop_extensions_apps_script.svg)

![Apps Script Run button location](./assets/sop_run_button.svg)

---

## 1) How to run Onboarding now

1. Open the **Onboarding** Google Sheet.
2. Click **Extensions** (top menu).
3. Click **Apps Script**.
4. In Apps Script, open the function dropdown (**Select function**).
5. Choose **`runOnboarding`**.
6. Click **Run** (▶).
7. Wait for the status to finish.
8. Click **Executions** and confirm the latest run says **Completed**.
9. Go back to the **Onboarding** tab and check recent rows.

What to check in the **Onboarding** tab after run:
- `status` should move toward **IN_PROGRESS** or **COMPLETE**.
- If something is blocked, `status` may show **BLOCKED** and `blocked_reason` explains why.
- `trace_id` should be filled for processed rows.

---

## 2) How to run Audit now

1. Open the **Audit** Google Sheet.
2. Click **Extensions**.
3. Click **Apps Script**.
4. In **Select function**, choose **`runAudit`**.
5. Click **Run** (▶).
6. Open **Executions** and confirm the newest run says **Completed**.
7. Open the **Audit** tab and confirm new rows were appended.

What to check in the **Audit** tab after run:
- A new row appears at the bottom.
- `event_timestamp` has the current time.
- `action` / `details` are populated.
- `event_hash` is populated.

---

## 3) What success looks like

You are done when all of these are true:

- Apps Script **Executions** shows **Completed** for the function you ran.
- **Onboarding** tab rows are updating (status and trace fields).
- **Audit** tab gets a fresh event row with timestamp.
- No new repeating errors in Executions.

---

## 4) Top 5 errors and what button/cell to check

| Error you may see | What it means in plain words | Exactly what to check |
|---|---|---|
| `Missing required Script Property: ...` | A required setting is empty. | In Apps Script, go to **Project Settings → Script Properties**. Check the missing key exactly (for example `ONBOARDING_SHEET_NAME`, `AUDIT_SHEET_NAME`, spreadsheet IDs). |
| `Sheet not found: ...` | The tab name does not match the setting. | Check the tab name at the bottom of the sheet, then check **Script Properties** (`ONBOARDING_SHEET_NAME` or `AUDIT_SHEET_NAME`). Names must match exactly. |
| `Schema mismatch... Missing required header(s)` | A required column header was changed or deleted. | Open row 1 of the affected tab (**Onboarding** or **Audit**) and confirm required headers exist (for example `status`, `blocked_reason`, `event_timestamp`, `event_hash`). |
| `Skipped ... because another run is in progress.` | Someone already clicked Run and it is still running. | Open **Executions** and wait for the active run to finish. Do not click Run repeatedly. |
| `Authorization required` / permission error | Your Google account has not approved access yet. | Click **Run** again and complete the Google permission pop-up. Use the correct work account with editor access. |

---

## 5) Who to contact with trace ID

When you escalate, include the **trace ID** so support can find the exact run quickly.

Send this to your **tech lead / automation support owner**:

- Function run: `runOnboarding` or `runAudit`
- Time run started
- Sheet + tab name (for example: **Onboarding → Onboarding**)
- Row number(s) affected
- `trace_id` value from the sheet row (or from execution logs)
- Screenshot of the error in **Executions**

Suggested message template:

> "Please help with HR automation. Function: `runOnboarding`. Sheet/tab: Onboarding → Onboarding. Trace ID: `<paste trace_id>`. Error: `<paste short error>`."
