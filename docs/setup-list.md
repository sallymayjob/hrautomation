# Setup List for Slack Intake Form

Use this list when configuring the **New Employee Name**, **Manager Email**, **Role**, **Brand**, and **Region** questions in Slack Workflow Builder.

## Required step before the form
Slack requires a message step with a `Continue Workflow` button before an interactive form when the trigger is `When a person joins a channel`.

Use a **Direct Message** step to notify HR approvals first, then continue to the form.

## New Employee Name question setup
Use this configuration for the first form question so onboarding can capture Slack user IDs directly:

- Label: `New Employee Name`
- Type: `Multiple Slack users`
- Required: Yes
- Hint (optional): `Tag the new starter(s) so Slack can pass their user ID(s).`

## Manager Email question setup
Use this configuration so manager details come from a Slack user selection (not free text):

- Label: `Manager Email`
- Type: `Slack person` (single Slack user)
- Required: No
- Mapping note: In Google Sheets mapping, use the selected user's **email token** for `manager_email`.

## Role options
Add these as selectable values for the `Role` question:

- Recruitment Consultant
- Resourcer
- Branch Manager
- Franchisee
- Admin
- Engineer
- Manager

## Brand options
Add these as selectable values for the `Brand` question:

- RWR_HEALTH
- HOSPOWORLD
- RETAILWORLD
- RWR_CONSTRUCTION

## Region options
Add these as selectable values for the `Region` question:

- NZ
- AU

## Notes
- Keep spelling/capitalization consistent so onboarding records are clean and easy to report on.
- You can extend the lists later as needed, but keep updates documented in this file for future admins.


## Data mapping guardrails
- Workflow mappings should populate **raw inputs only** (name, email, role, brand, region, dates, notes).
- Do not map ID/derived columns from Slack steps.
- Keep `onboarding_id`, audit IDs, completion flags, and event keys formula-driven in Google Sheets named functions (`SYS_MAKE_ID`, `SYS_IS_COMPLETE`, `SYS_EVENT_KEY`).
- Apps Script should treat non-empty formula-derived IDs as immutable.

