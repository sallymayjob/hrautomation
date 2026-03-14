/* global */
/**
 * @fileoverview Shared immutable constants/enums for governance, datasets, channels, and schema headers.
 */

var CoreConstants = {
  ACTIONS: {
    LESSON_CREATE: 'lesson_create',
    LESSON_EDIT: 'lesson_edit',
    LESSON_OVERWRITE: 'lesson_overwrite',
    LESSON_VERSION: 'lesson_version',
    LESSON_MAPPING_CHANGE: 'lesson_mapping_change'
  },

  APPROVAL_REQUIRED_ACTIONS: {
    lesson_create: true,
    lesson_edit: true,
    lesson_overwrite: true,
    lesson_version: true,
    lesson_mapping_change: true,
    create_lesson: true,
    edit_lesson: true,
    overwrite_lesson: true,
    version_lesson: true,
    update_lesson_mapping: true
  },

  STATUSES: {
    PENDING: 'PENDING',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
    IN_PROGRESS: 'IN_PROGRESS',
    NOT_STARTED: 'NOT_STARTED',
    OVERDUE: 'OVERDUE',
    COMPLETE: 'COMPLETE',
    COMPLETED: 'COMPLETED',
    BLOCKED: 'BLOCKED',
    DONE: 'DONE'
  },

  STATUS_SETS: {
    ONBOARDING: ['PENDING', 'IN_PROGRESS', 'BLOCKED', 'COMPLETE'],
    CHECKLIST: ['PENDING', 'IN_PROGRESS', 'BLOCKED', 'COMPLETE'],
    TRAINING: ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE'],
    APPROVALS: ['PENDING', 'APPROVED', 'REJECTED']
  },

  STATUS_ALIASES: {
    ONBOARDING: {
      COMPLETED: 'COMPLETE',
      DONE: 'COMPLETE'
    },
    CHECKLIST: {
      DONE: 'COMPLETE',
      COMPLETED: 'COMPLETE'
    },
    TRAINING: {
      COMPLETE: 'COMPLETED',
      Completed: 'COMPLETED',
      'COMPLETED ': 'COMPLETED',
      'NOT STARTED': 'NOT_STARTED',
      'In Progress': 'IN_PROGRESS',
      'Not Started': 'NOT_STARTED',
      'Overdue': 'OVERDUE'
    },
    APPROVALS: {}
  },

  ENTITY_NAMES: {
    LESSON: 'lesson',
    LMS_ACTION: 'lms_action',
    PROPOSAL: 'proposal'
  },

  DATASET_KEYS: {
    ONBOARDING: 'onboarding',
    TRAINING: 'training',
    AUDIT: 'audit',
    CHECKLIST: 'checklist',
    MAPPING: 'mapping',
    LESSONS: 'lessons',
    MAPPINGS: 'mappings',
    APPROVALS: 'approvals',
    SUBMISSIONS: 'submissions'
  },

  CHANNEL_KEYS: {
    ADMIN: 'ADMIN',
    FINANCE: 'FINANCE',
    HR: 'HR',
    IT: 'IT',
    LEGAL: 'LEGAL',
    OPERATIONS: 'OPERATIONS',
    PEOPLE: 'PEOPLE',
    PEOPLE_OPS: 'PEOPLE OPS'
  },

  SCHEMA: {
    CONFIG_TAB: '_sys_config',
    VERSION_KEY: 'version',
    LIBRARY_SCHEMA_VERSION: 'schema_v1',
    SHEET_DEFINITIONS: {
      onboarding: {
        expectedVersion: 3,
        requiredHeaders: ['onboarding_id', 'employee_name', 'email', 'role', 'start_date', 'manager_email', 'status', 'checklist_completed', 'row_hash', 'blocked_reason']
      },
      training: {
        expectedVersion: 1,
        requiredHeaders: ['employee_id', 'module_code', 'module_name', 'assigned_date', 'due_date', 'completion_date', 'training_status', 'owner_email', 'reminder_count', 'last_reminder_at', 'last_updated_at', 'completion_hash', 'celebration_posted'],
        legacyHeaderAliases: {
          employee_id: ['training_id', 'onboarding_id'],
          module_code: ['modulecode', 'resource_code'],
          module_name: ['resource_title'],
          assigned_date: ['assigned_at'],
          completion_date: ['completed_at'],
          training_status: ['status'],
          owner_email: ['owner', 'manager_email', 'resource_owner_email'],
          last_updated_at: ['updated_at']
        }
      },
      audit: {
        expectedVersion: 1,
        requiredHeaders: ['audit_id', 'event_timestamp', 'actor_email', 'entity_type', 'entity_id', 'action', 'details', 'event_hash']
      },
      checklist: {
        expectedVersion: 1,
        requiredHeaders: ['task_id', 'onboarding_id', 'phase', 'task_name', 'owner_team', 'owner_slack_channel', 'status', 'due_date', 'updated_at', 'updated_by', 'notes']
      },
      lessons: {
        expectedVersion: 1,
        optional: true,
        requiredHeaders: ['lesson_id', 'module_code', 'lesson_title', 'version', 'source', 'trace_id', 'approval_status', 'submitted_by', 'approved_by', 'submitted_at', 'approved_at', 'created_at', 'updated_at']
      },
      mappings: {
        expectedVersion: 1,
        optional: true,
        requiredHeaders: ['mapping_id', 'lesson_id', 'target_entity', 'target_key', 'version', 'source', 'trace_id', 'approval_status', 'submitted_by', 'approved_by', 'submitted_at', 'approved_at', 'created_at', 'updated_at']
      },
      approvals: {
        expectedVersion: 1,
        optional: true,
        requiredHeaders: ['approval_id', 'entity_type', 'entity_key', 'approval_status', 'submitted_by', 'approved_by', 'trace_id', 'version', 'source', 'submitted_at', 'approved_at', 'created_at', 'updated_at']
      },
      submissions: {
        expectedVersion: 1,
        optional: true,
        requiredHeaders: ['submission_id', 'entity_type', 'entity_key', 'payload_json', 'approval_status', 'submitted_by', 'approved_by', 'trace_id', 'version', 'source', 'submitted_at', 'approved_at', 'created_at', 'updated_at']
      }
    },
    REPOSITORY_HEADERS: {
      submissions: ['submission_id', 'entity_type', 'entity_key', 'payload_json', 'approval_status', 'submitted_by', 'approved_by', 'trace_id', 'version', 'source', 'submitted_at', 'approved_at', 'created_at', 'updated_at', 'action', 'request_id', 'requires_approval', 'proposal_hash', 'approval_hash', 'approval_version', 'rejection_reason', 'committed_at']
    }
  }
};

function normalizeStatusValue_(rawValue, statusSet, aliases) {
  var normalized = String(rawValue || '').trim();
  if (!normalized) {
    return '';
  }

  if (aliases && aliases[normalized]) {
    return aliases[normalized];
  }

  var upper = normalized.toUpperCase().replace(/\s+/g, '_');
  if (aliases && aliases[upper]) {
    return aliases[upper];
  }

  if ((statusSet || []).indexOf(upper) > -1) {
    return upper;
  }

  return upper;
}

function normalizeOnboardingStatus(rawValue) {
  return normalizeStatusValue_(rawValue, CoreConstants.STATUS_SETS.ONBOARDING, CoreConstants.STATUS_ALIASES.ONBOARDING);
}

function normalizeChecklistStatus(rawValue) {
  return normalizeStatusValue_(rawValue, CoreConstants.STATUS_SETS.CHECKLIST, CoreConstants.STATUS_ALIASES.CHECKLIST);
}

function normalizeTrainingStatus(rawValue) {
  return normalizeStatusValue_(rawValue, CoreConstants.STATUS_SETS.TRAINING, CoreConstants.STATUS_ALIASES.TRAINING);
}

function normalizeApprovalStatus(rawValue) {
  return normalizeStatusValue_(rawValue, CoreConstants.STATUS_SETS.APPROVALS, CoreConstants.STATUS_ALIASES.APPROVALS);
}

function isChecklistDoneStatus(rawValue) {
  return normalizeChecklistStatus(rawValue) === CoreConstants.STATUSES.COMPLETE;
}

if (typeof module !== 'undefined') {
  module.exports = {
    CoreConstants: CoreConstants,
    normalizeOnboardingStatus: normalizeOnboardingStatus,
    normalizeChecklistStatus: normalizeChecklistStatus,
    normalizeTrainingStatus: normalizeTrainingStatus,
    normalizeApprovalStatus: normalizeApprovalStatus,
    isChecklistDoneStatus: isChecklistDoneStatus
  };
}
