/**
 * @fileoverview Checklist task template for onboarding task generation.
 */

var CHECKLIST_TASK_TEMPLATE = [
  {
    task_id: 'DOC-001',
    category: 'Documentation',
    phase: 'Documentation',
    task_name: 'Share employee handbook and policy acknowledgement',
    owner_team: 'People Ops',
    owner_slack_id: '@people-ops',
    due_offset_days: 1,
    brand_rules: ['*'],
    region_rules: ['*'],
    role_rules: ['*'],
    notes: 'Must be completed in first business day',
    required_for_completion: true
  },
  {
    task_id: 'WRK-001',
    category: 'Workspace',
    phase: 'Pre-onboarding',
    task_name: 'Provision Google Workspace account',
    owner_team: 'IT',
    owner_slack_id: '@it-helpdesk',
    due_offset_days: 0,
    brand_rules: ['*'],
    region_rules: ['*'],
    role_rules: ['*'],
    notes: 'Includes shared drive and calendar access',
    required_for_completion: true
  },
  {
    task_id: 'WRK-002',
    category: 'Workspace',
    phase: 'Day-1 readiness',
    task_name: 'Grant engineering repos and deployment tooling',
    owner_team: 'IT',
    owner_slack_id: '@it-helpdesk',
    due_offset_days: 1,
    brand_rules: ['*'],
    region_rules: ['*'],
    role_rules: ['ENGINEER'],
    notes: 'Required for all engineering hires',
    required_for_completion: true
  },
  {
    task_id: 'MKT-001',
    category: 'Marketing',
    phase: 'Day-1 readiness',
    task_name: 'Create intro blurb for internal comms',
    owner_team: 'Marketing',
    owner_slack_id: '@marketing-ops',
    due_offset_days: 3,
    brand_rules: ['Acme', 'Globex'],
    region_rules: ['*'],
    role_rules: ['*'],
    notes: 'Skip for confidential hires',
    required_for_completion: false
  },
  {
    task_id: 'FIN-001',
    category: 'Finance',
    phase: 'Pre-onboarding',
    task_name: 'Set up payroll profile and tax details',
    owner_team: 'Finance',
    owner_slack_id: '@finance-payroll',
    due_offset_days: 2,
    brand_rules: ['*'],
    region_rules: ['NZ', 'AU', 'US'],
    role_rules: ['*'],
    notes: 'Region-specific tax forms apply',
    required_for_completion: true
  },
  {
    task_id: 'FIN-002',
    category: 'Finance',
    phase: 'Documentation',
    task_name: 'Issue corporate card approval for managers',
    owner_team: 'Finance',
    owner_slack_id: '@finance-payroll',
    due_offset_days: 5,
    brand_rules: ['*'],
    region_rules: ['*'],
    role_rules: ['MANAGER'],
    notes: 'Only if role level requires budget authority',
    required_for_completion: false
  }
];

if (typeof module !== 'undefined') module.exports = { CHECKLIST_TASK_TEMPLATE: CHECKLIST_TASK_TEMPLATE };
