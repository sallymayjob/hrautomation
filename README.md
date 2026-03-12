# RWR-HAF Overview

## 1. What does this system do?
RWR-HAF sends welcome, reminder, and celebration Slack messages for new employees. It supports RWR Health, Hospoworld, Retailworld, and RWR Construction in New Zealand and Australia. Think of it like a very organised colleague who never forgets a message and works all day, every day.

You're done with this part.

## 2. How does it work?
1. A new person joins the `#new-hires` Slack channel (a shared team chat room).
2. HR approvals receive a direct message notification with a `Continue Workflow` button.
3. HR clicks the button, then a form (a question page) appears asking for the new hire details, including required Buddy (peer) and Manager (trainer).
4. The form saves their details into the Onboarding spreadsheet and the automation assigns an `onboarding_id` automatically.
5. The system reads the spreadsheet and sends a welcome message with training links.
6. Every morning, the system checks upcoming or overdue training.
7. The system sends reminder messages to the right people.
8. When training is finished, the system posts a celebration in `#general`.

Think of the spreadsheet like a filing cabinet. The system checks that filing cabinet each morning for today's messages.

You're done with this part.

## 3. Who does what?

| Person | What they do | How often |
|---|---|---|
| New hire | Receives messages and clicks training links | During onboarding period |
| Manager (trainer) | Listed on each onboarding as the trainer and receives assignment notifications | Each new starter |
| Buddy (peer) | Listed on each onboarding as the peer buddy and receives assignment notifications | Each new starter |
| Admin team | Sets up computer, email, and Slack before day one | Each new starter |
| HR manager | Checks progress in the spreadsheet and updates changed training links | Weekly |
| Tech lead | Fixes issues when something breaks after setup | Rarely |

You're done with this part.

## 4. What you need before starting
1. A Slack workspace (your RWR Group team chat account).
2. A Google account with access to Sheets and Drive.
3. A Slack app named "RWR HR Automation" created by the tech lead.
4. Three empty Google Sheets named Onboarding, Training Log, and Audit Log (kept as separate spreadsheets).
5. This file folder prepared by the tech lead.

You're done with this part.


## Slack editing guardrail (important)
Slack command responses and Slack message interactions are **read-only** for onboarding and checklist verification.
- Use Slack to view onboarding/checklist progress.
- Make all status edits in Google Sheets (Onboarding, Checklist Tasks, and Training Log as applicable).
- Do not expect Slack buttons or interactive actions to update statuses.

## 5. Where to go if something is not working
- If a new hire did not receive a welcome message, tell the tech lead. They can fix it in under five minutes.
- If a reminder went to the wrong person, tell the tech lead immediately.
- If you are unsure the system is running, check Audit Log. If today's rows exist, it is working.

You're done with this part.

## Architecture and dataflow
- See `docs/architecture-dataflow.md` for sheet connections, ownership boundaries, write rules, and failure behavior.

