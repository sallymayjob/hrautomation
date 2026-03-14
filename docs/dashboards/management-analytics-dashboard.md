# Management Analytics Dashboard Spec (BI Layer)

## Purpose
This dashboard is intended for leadership and planning. It focuses on trends, forecasting, and cross-functional performance rather than operational task handling.

## Recommended Tooling
Use a BI tool (Power BI, Looker Studio, or Tableau) fed from curated HR data marts. Keep AppSheet for operational workflows and approvals.

## Core Subject Areas
- Workforce and headcount
- Leave and attendance
- Recruiting pipeline efficiency
- Onboarding cycle-time and quality
- SLA and process health

## Executive KPI Set
1. **Headcount trend (MoM / QoQ)**
2. **Attrition rate** (voluntary, involuntary)
3. **Time-to-fill** (median days requisition open to accepted offer)
4. **Offer acceptance rate**
5. **Onboarding completion within SLA**
6. **Average approval turnaround**
7. **SLA breach rate by process**

## Visual Layout (Single Executive Page)
- Top row: KPI cards (7 metrics)
- Left panel: headcount and attrition trend lines
- Center panel: recruitment funnel with stage conversion rates
- Right panel: onboarding SLA compliance by region/team
- Bottom panel: approval turnaround distribution and breach heatmap

## Drill-Down Pages
- `pg_workforce`
  - department, region, manager breakdown
  - monthly headcount and attrition cohorts
- `pg_recruiting`
  - requisition aging, source effectiveness, conversion by stage
- `pg_onboarding`
  - cycle-time decomposition and blocker categories
- `pg_process_sla`
  - SLA breaches by workflow, owner, and escalation tier

## Data Model Requirements
- Build conformed dimensions: `dim_date`, `dim_employee`, `dim_department`, `dim_region`, `dim_manager`.
- Build facts:
  - `fact_leave_requests`
  - `fact_recruitment_events`
  - `fact_onboarding_events`
  - `fact_approval_events`
- Use consistent business keys (`employee_id`, `req_id`, `workflow_id`) across facts.

## Governance and Refresh
- Refresh cadence: daily for executive dashboards, hourly for recruiting operations if needed.
- Metric dictionary required for each KPI (owner, formula, source, and caveats).
- Version-controlled SQL/transform logic for reproducibility.

## Decision Rules
- Use AppSheet dashboard for action execution (approve, assign, follow-up).
- Use BI dashboard for quarterly planning, target setting, and executive review.
