# AppSheet Operational Dashboard Spec (Internal Workflow)

## Purpose
This dashboard is designed for in-app, day-to-day execution. It prioritizes actions (approvals, escalations, and follow-ups) over long-term analysis.

## Persona Views
- **HR Ops**: global queue visibility and SLA risk.
- **Managers**: team-specific approvals and onboarding blockers.
- **Employees**: personal request status and next steps.

## Data Entities (AppSheet Tables)
- `Employees`
- `LeaveRequests`
- `RecruitmentPipeline`
- `Onboarding`
- `Tasks`
- `Approvals`

## Slices
1. `sl_pending_approvals`
   - Source: `Approvals`
   - Row filter: `[status] = "PENDING"`
2. `sl_overdue_tasks`
   - Source: `Tasks`
   - Row filter: `AND([status] <> "COMPLETE", [due_date] < TODAY())`
3. `sl_today_actions`
   - Source: `Tasks`
   - Row filter: `[due_date] = TODAY()`
4. `sl_active_requisitions`
   - Source: `RecruitmentPipeline`
   - Row filter: `IN([stage], {"OPEN", "INTERVIEW", "OFFER"})`
5. `sl_inflight_onboarding`
   - Source: `Onboarding`
   - Row filter: `IN([status], {"PENDING", "IN_PROGRESS", "BLOCKED"})`

## KPI Cards (Card/Deck Views)
- `pending_approval_count` = `COUNT(sl_pending_approvals)`
- `overdue_task_count` = `COUNT(sl_overdue_tasks)`
- `today_action_count` = `COUNT(sl_today_actions)`
- `open_requisition_count` = `COUNT(sl_active_requisitions)`
- `inflight_onboarding_count` = `COUNT(sl_inflight_onboarding)`

## Charts
- **Approvals by status** (chart source: `Approvals`, category: status, aggregation: count)
- **Tasks by SLA bucket** (today, 1-2 days overdue, 3+ days overdue)
- **Recruitment funnel** (OPEN -> INTERVIEW -> OFFER -> HIRED)
- **Onboarding completion trend** (weekly completion count)

## Dashboard Composition
Create one dashboard view named `db_operational_control` including:
1. KPI card strip (5 cards)
2. Pending approvals table
3. Overdue tasks table
4. Recruitment funnel chart
5. Onboarding trend chart

Set **Interactive mode = ON** so selecting a chart segment filters related tables.

## Automation Hooks
- Scheduled bot: send daily digest of `sl_overdue_tasks` to HR Ops.
- Event bot: notify approver when a row enters `Approvals` with status `PENDING`.
- Escalation bot: if approval pending > 48h, notify manager + HR shared inbox.

## Security Filters
- HR Ops: full access.
- Manager: rows where `[manager_email] = USEREMAIL()`.
- Employee: rows where `[employee_email] = USEREMAIL()`.

## Success Criteria
- 80%+ of pending workflow actions resolved from the dashboard without opening external tools.
- SLA-breached tasks reduced by at least 20% after rollout.
