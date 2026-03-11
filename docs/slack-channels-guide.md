# Slack Channels Setup Guide

Use this guide to create and configure the Slack channels needed by RWR-HAF.

## Why these channels are required
The automation posts to specific channels for approvals, alerts, and recognition.
If a required channel is missing or has the wrong privacy settings, messages may fail.

## Required channels
Create these channels with the exact names below.

| Channel | Required | Type | Purpose | Used by property |
|---|---|---|---|---|
| `#new-hires` | Yes | Public | Trigger channel for the onboarding workflow form (`When a person joins a channel`). | N/A (selected inside Workflow Builder) |
| `#hr-ops-alerts` | Yes | Private or Public (recommended: Private) | HR operations alerts and escalation notices. | `HR_ALERTS_CHANNEL_ID` |
| `#hr-approvals` | Yes | Private | Approval requests and manager follow-up decisions. | `HR_APPROVALS_CHANNEL_ID` |
| `#general` | Yes | Public | Company-wide celebration and recognition posts. | `GENERAL_CHANNEL_ID` |

## Before you start
- You need permission in Slack to create channels.
- You must be able to invite apps to channels.
- Keep channel names lowercase with hyphens, matching the list above.

## Step 1 — Create each channel
1. Open Slack.
2. In the left sidebar, click the `+` next to Channels.
3. Click **Create a channel**.
4. Enter the exact channel name (for example, `hr-ops-alerts` for `#hr-ops-alerts`).
5. Choose **Public** or **Private** based on the table above.
6. Click **Create**.
7. Repeat for all required channels.

## Step 2 — Add the right members
Add the right people so approvals and alerts are seen.

- `#hr-ops-alerts`: HR operations team and at least one backup admin.
- `#hr-approvals`: HR approvers and managers who approve training/compliance tasks.
- `#general`: Usually already populated by workspace defaults.
- `#new-hires`: Keep available for onboarding workflow triggers.

## Step 3 — Invite the Slack app to each required channel
After app installation, invite the bot to all channels it needs to post in.

1. Open each required channel.
2. In the message box, type `/invite @New Hire Intake Bot`.
3. Press Enter.
4. Confirm the bot appears in channel members.

If your workspace blocks `/invite`, use channel settings → **Integrations** → **Add apps**.

## Step 4 — Capture channel IDs for deployment
You will enter these IDs in Apps Script properties during deployment.

1. Right-click the channel in Slack sidebar.
2. Click **Open channel details** or **View channel details**.
3. Scroll to the bottom.
4. Copy the channel ID (looks like `C01234ABCDE`).
5. Save each ID in your secure deployment note.

Capture IDs for:
- `#hr-ops-alerts` → `HR_ALERTS_CHANNEL_ID`
- `#hr-approvals` → `HR_APPROVALS_CHANNEL_ID`
- `#general` → `GENERAL_CHANNEL_ID`

## Validation checklist
Before moving on, confirm all checks below:

- [ ] All 4 required channels exist with exact names.
- [ ] Privacy settings match the recommended channel type.
- [ ] `@New Hire Intake Bot` is invited to each required posting channel.
- [ ] Channel IDs were copied and saved for deployment properties.

## Troubleshooting
### Bot cannot post to a channel
- Confirm the bot is invited to that channel.
- Confirm the channel ID in Script Properties matches the actual channel.
- Confirm the app still has these OAuth scopes: `chat:write`, `chat:write.public`, `users:read`, `users:read.email`.

### Workflow trigger does not start when someone joins
- Confirm the workflow is attached to `#new-hires`.
- Confirm the channel is public and active.
- Reopen Workflow Builder and verify trigger settings were saved.
