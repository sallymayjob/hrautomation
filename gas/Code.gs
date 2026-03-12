/* global SheetClient, SlackClient, AuditLogger, BlockKit, computeHash, generateId, CHECKLIST_TASK_TEMPLATE, Config, console */
/**
 * @fileoverview Main trigger handlers for onboarding processing.
 */

var CHECKLIST_HEADERS = [
  'task_id',
  'onboarding_id',
  'phase',
  'task_name',
  'owner_team',
  'owner_slack_channel',
  'status',
  'due_date',
  'updated_at',
  'updated_by',
  'notes'
];

var STATUS = {
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  BLOCKED: 'BLOCKED',
  COMPLETE: 'COMPLETE'
};


var WORKFLOW_NAME = 'onboarding_workflow';

var WORKFLOW_EVENT_TYPES = {
  WORKFLOW_CALLED: 'WORKFLOW_CALLED',
  WORKFLOW_STARTED: 'WORKFLOW_STARTED',
  WORKFLOW_ENDED: 'WORKFLOW_ENDED'
};

var ROLE_MAPPINGS = {
  DEFAULT: {
    probationDays: 90,
    resources: [
      { moduleCode: 'ORG-101', moduleName: 'Company Orientation', dueOffsetDays: 7 },
      { moduleCode: 'SEC-101', moduleName: 'Security Awareness', dueOffsetDays: 14 }
    ]
  },
  ENGINEER: {
    probationDays: 90,
    resources: [
      { moduleCode: 'ENG-101', moduleName: 'Engineering Onboarding', dueOffsetDays: 5 },
      { moduleCode: 'SEC-101', moduleName: 'Security Awareness', dueOffsetDays: 14 }
    ]
  },
  MANAGER: {
    probationDays: 120,
    resources: [
      { moduleCode: 'MGR-101', moduleName: 'People Leadership Essentials', dueOffsetDays: 10 },
      { moduleCode: 'SEC-101', moduleName: 'Security Awareness', dueOffsetDays: 14 }
    ]
  }
};

function onChangeHandler(e) {
  var sheet = e && e.source && e.source.getActiveSheet ? e.source.getActiveSheet() : null;
  if (!sheet || sheet.getName() !== Config.getOnboardingSheetName()) {
    return;
  }

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return;
  }

  validateOnboardingSchema_(sheet);

  var workflowContext = buildWorkflowContext_(e);
  var sheetClient = new SheetClient();
  var auditLogger = new AuditLogger(sheetClient);
  emitLifecycleEvent_(auditLogger, workflowContext, WORKFLOW_EVENT_TYPES.WORKFLOW_CALLED, '');

  for (var rowIndex = 2; rowIndex <= lastRow; rowIndex += 1) {
    var headerMap = getHeaderMap_(sheet);
    hydrateOnboardingDefaults_(sheet, rowIndex, headerMap);
    if (!shouldProcessOnboardingRow_(sheet, rowIndex, headerMap)) {
      continue;
    }

    var onboardingId = String(sheet.getRange(rowIndex, headerMap.onboarding_id).getValue() || '').trim();
    var rowWorkflowContext = cloneWorkflowContext_(workflowContext);
    rowWorkflowContext.onboardingId = onboardingId;
    processOnboardingRow_(sheet, rowIndex, rowWorkflowContext);
  }
}

function hydrateOnboardingDefaults_(sheet, rowIndex, headerMap) {
  var onboardingId = String(sheet.getRange(rowIndex, headerMap.onboarding_id).getValue() || '').trim();
  if (!onboardingId) {
    setValueIfColumnExists_(sheet, rowIndex, headerMap, 'onboarding_id', generateId('ONB'));
  }

  var statusValue = String(sheet.getRange(rowIndex, headerMap.status).getValue() || '').trim().toUpperCase();
  if (!statusValue) {
    setStatus_(sheet, rowIndex, headerMap, STATUS.PENDING);
  }

  if (headerMap.checklist_completed) {
    var checklistCompleted = sheet.getRange(rowIndex, headerMap.checklist_completed).getValue();
    if (checklistCompleted === '' || checklistCompleted === null) {
      setValueIfColumnExists_(sheet, rowIndex, headerMap, 'checklist_completed', false);
    }
  }
}

function processOnboardingRow_(sheet, rowIndex, workflowContext) {
  var sheetClient = new SheetClient();
  var auditLogger = new AuditLogger(sheetClient);
  var slackClient = new SlackClient(auditLogger);
  var runContext = workflowContext || buildWorkflowContext_();
  emitLifecycleEvent_(auditLogger, runContext, WORKFLOW_EVENT_TYPES.WORKFLOW_STARTED, runContext.onboardingId || '');
  var headerMap = getHeaderMap_(sheet);
  validateOnboardingSchema_(sheet, headerMap);

  try {
    var rowValues = sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn()).getValues()[0];
    var rowData = toRowObject_(rowValues, headerMap);
    var normalizedRowData = normalizeOnboardingRowData_(rowData);

    if (!headerMap.status) {
      processChecklistOnlyOnboardingRow_(sheetClient, auditLogger, normalizedRowData);
      return;
    }

    var rowHash = computeHash([
      normalizedRowData.email,
      formatDateKey_(normalizedRowData.start_date),
      normalizedRowData.role,
      normalizedRowData.manager_email
    ]);
    if (headerMap.row_hash) {
      setValueIfColumnExists_(sheet, rowIndex, headerMap, 'row_hash', rowHash);
    }

    var duplicateRow = headerMap.row_hash ? sheetClient.checkDuplicate(Config.getOnboardingSheetName(), 'row_hash', rowHash, rowIndex) : -1;
    if (duplicateRow > -1) {
      setStatus_(sheet, rowIndex, headerMap, STATUS.BLOCKED);
      setBlockedReason_(sheet, rowIndex, headerMap, 'Duplicate onboarding row found. Matched row index ' + duplicateRow + '.');
      auditLogger.log({
        entityType: 'Onboarding',
        entityId: String(normalizedRowData.onboarding_id || rowIndex),
        action: 'UPDATE',
        details: 'Marked as duplicate. Matched row index ' + duplicateRow + '.'
      });
      return;
    }

    var managerEmail = String(normalizedRowData.manager_email || '').trim();
    if (!managerEmail) {
      throw new Error('Manager email is required for onboarding so the trainer can be assigned.');
    }

    var buddyEmail = String(normalizedRowData.buddy_email || '').trim();
    if (!buddyEmail) {
      throw new Error('Buddy email is required for onboarding so a peer can be assigned.');
    }

    var managerSlackId = '';
    var managerLookup = slackClient.lookupUserByEmail(managerEmail);
    managerSlackId = managerLookup && managerLookup.user && managerLookup.user.id ? managerLookup.user.id : '';
    setValueIfColumnExists_(sheet, rowIndex, headerMap, 'manager_slack_id', managerSlackId);

    var buddySlackId = String(normalizedRowData.buddy_slack_id || '').trim();
    if (!buddySlackId) {
      var buddyLookup = slackClient.lookupUserByEmail(buddyEmail);
      buddySlackId = buddyLookup && buddyLookup.user && buddyLookup.user.id ? buddyLookup.user.id : '';
      setValueIfColumnExists_(sheet, rowIndex, headerMap, 'buddy_slack_id', buddySlackId);
    }

    var roleMapping = getRoleMapping_(normalizedRowData.role);
    var startDate = parseDateValue_(normalizedRowData.start_date);
    var employeeLookup = slackClient.lookupUserByEmail(normalizedRowData.email);
    var employeeSlackId = employeeLookup && employeeLookup.user && employeeLookup.user.id ? employeeLookup.user.id : '';
    if (!employeeSlackId) {
      throw new Error('Unable to resolve employee Slack ID for email: ' + normalizedRowData.email);
    }

    slackClient.postMessage(employeeSlackId, BlockKit.welcomeDM({
      firstName: getFirstName_(normalizedRowData.employee_name),
      startDate: formatDateKey_(startDate),
      managerName: managerEmail || 'TBD'
    }));

    notifyOnboardingAssignment_(sheetClient, auditLogger, slackClient, {
      onboardingId: normalizedRowData.onboarding_id,
      employeeName: normalizedRowData.employee_name,
      managerSlackId: managerSlackId,
      buddySlackId: buddySlackId,
      buddyLabel: buddyEmail || buddySlackId || 'Not assigned yet',
      teamLabel: [normalizedRowData.brand, normalizedRowData.region, normalizedRowData.role].filter(function (value) {
        return String(value || '').trim() !== '';
      }).join(' / ') || 'General onboarding'
    });

    for (var i = 0; i < roleMapping.resources.length; i += 1) {
      var resource = roleMapping.resources[i];
      var dueDate = computeDueDate_(startDate, roleMapping.probationDays, resource.dueOffsetDays);
      sheetClient.appendTrainingRow([
        normalizedRowData.onboarding_id,
        resource.moduleCode,
        resource.moduleName,
        new Date(),
        dueDate,
        '',
        'ASSIGNED',
        managerEmail || '',
        0,
        '',
        new Date(),
        computeHash([normalizedRowData.onboarding_id, resource.moduleCode, formatDateKey_(dueDate)]),
        false
      ]);
    }

    var onboardingId = normalizedRowData.onboarding_id || generateId('ONB');
    if (!normalizedRowData.onboarding_id) {
      setValueIfColumnExists_(sheet, rowIndex, headerMap, 'onboarding_id', onboardingId);
    }
    generateChecklistTasks_(sheetClient, auditLogger, onboardingId, normalizedRowData, startDate, new Date());
    setValueIfColumnExists_(sheet, rowIndex, headerMap, 'dm_sent_at', new Date());
    setValueIfColumnExists_(sheet, rowIndex, headerMap, 'processed_at', new Date());
    setStatus_(sheet, rowIndex, headerMap, STATUS.IN_PROGRESS);
    setBlockedReason_(sheet, rowIndex, headerMap, '');

    auditLogger.log({
      entityType: 'Onboarding',
      entityId: onboardingId,
      action: 'UPDATE',
      details: 'Onboarding processed successfully for onboarding_id=' + onboardingId + '.'
    });
    runContext.onboardingId = onboardingId;
  } catch (err) {
    setStatus_(sheet, rowIndex, headerMap, STATUS.BLOCKED);
    setBlockedReason_(sheet, rowIndex, headerMap, String(err && err.message ? err.message : err));
    setValueIfColumnExists_(sheet, rowIndex, headerMap, 'error_message', String(err && err.message ? err.message : err));
    console.error('Onboarding processing failed for row ' + rowIndex + ': ' + err);
    auditLogger.error({
      entityType: 'Onboarding',
      entityId: 'row_' + rowIndex,
      action: 'UPDATE',
      details: 'Onboarding processing failed.'
    }, err);
  } finally {
    emitLifecycleEvent_(auditLogger, runContext, WORKFLOW_EVENT_TYPES.WORKFLOW_ENDED, runContext.onboardingId || '');
  }
}


function buildWorkflowContext_(e) {
  var metadata = extractWorkflowMetadata_(e);
  return {
    workflowName: WORKFLOW_NAME,
    workflowRunKey: computeHash([metadata.requester, metadata.ts, metadata.workflowId]),
    actor: metadata.requester,
    sourceTrigger: metadata.sourceTrigger,
    onboardingId: ''
  };
}

function cloneWorkflowContext_(workflowContext) {
  return {
    workflowName: workflowContext.workflowName,
    workflowRunKey: workflowContext.workflowRunKey,
    actor: workflowContext.actor,
    sourceTrigger: workflowContext.sourceTrigger,
    onboardingId: workflowContext.onboardingId || ''
  };
}

function emitLifecycleEvent_(auditLogger, workflowContext, eventType, onboardingId) {
  var eventPayload = {
    workflow_name: workflowContext.workflowName,
    workflow_run_key: workflowContext.workflowRunKey,
    event_type: eventType,
    actor: workflowContext.actor,
    source_trigger: workflowContext.sourceTrigger,
    onboarding_id: onboardingId || ''
  };

  if (auditLogger && typeof auditLogger.logWorkflowLifecycle === 'function') {
    auditLogger.logWorkflowLifecycle(eventPayload);
    return;
  }

  if (auditLogger && auditLogger.sheetClient && typeof auditLogger.sheetClient.appendWorkflowLifecycleEvent === 'function') {
    auditLogger.sheetClient.appendWorkflowLifecycleEvent(eventPayload);
  }
}

function extractWorkflowMetadata_(e) {
  var payload = (e && (e.slackPayload || e.payload || e.metadata)) || {};
  var requester = String(
    payload.requester ||
    payload.user_id ||
    payload.userId ||
    payload.actor ||
    payload.email ||
    'system'
  );
  var ts = String(payload.ts || payload.trigger_ts || payload.event_ts || payload.message_ts || '0');
  var workflowId = String(payload.workflow_id || payload.workflowId || payload.callback_id || 'onChangeHandler');
  var sourceTrigger = String((e && (e.triggerUid || e.triggerUid || e.changeType)) || payload.source_trigger || 'on_change');

  return {
    requester: requester,
    ts: ts,
    workflowId: workflowId,
    sourceTrigger: sourceTrigger
  };
}

function getRoleMapping_(roleTitle) {
  var key = String(roleTitle || '').trim().toUpperCase();
  return ROLE_MAPPINGS[key] || ROLE_MAPPINGS.DEFAULT;
}

function computeDueDate_(startDate, probationDays, dueOffsetDays) {
  var offset = typeof dueOffsetDays === 'number' ? dueOffsetDays : probationDays;
  var dueDate = new Date(startDate.getTime());
  dueDate.setDate(dueDate.getDate() + offset);
  return dueDate;
}


function computeTemplateDueDate_(template, startDate, triggerTimestamp) {
  var offsetType = String(template.offset_type || '').trim().toUpperCase() || 'DAYS_FROM_START';
  var offsetDays = Number(template.offset_days);
  if (isNaN(offsetDays)) {
    offsetDays = Number(template.due_offset_days || 0);
  }

  if (offsetType === 'FIRST_24_HOURS') {
    var dueFromTrigger = new Date((triggerTimestamp || new Date()).getTime());
    dueFromTrigger.setHours(dueFromTrigger.getHours() + 24);
    dueFromTrigger.setDate(dueFromTrigger.getDate() + offsetDays);
    return dueFromTrigger;
  }

  return computeDueDate_(startDate, 0, offsetDays);
}

function getHeaderMap_(sheet) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var map = {};
  for (var i = 0; i < headers.length; i += 1) {
    var key = normalizeKey_(headers[i]);
    if (key) {
      map[key] = i + 1;
    }
  }
  return map;
}

function shouldProcessOnboardingRow_(sheet, rowIndex, headerMap) {
  if (headerMap.status) {
    var statusValue = String(sheet.getRange(rowIndex, headerMap.status).getValue() || '').trim().toUpperCase();
    return statusValue === STATUS.PENDING;
  }
  if (headerMap.checklist_completed) {
    return !Boolean(sheet.getRange(rowIndex, headerMap.checklist_completed).getValue());
  }
  return true;
}

function validateOnboardingSchema_(sheet, headerMap) {
  var map = headerMap || getHeaderMap_(sheet);
  var legacyRequiredKeys = ['start_date', 'manager_email', 'buddy_email'];
  var intakeRequiredKeys = ['first_name', 'last_name', 'personal_email', 'job_title', 'department', 'start_date', 'manager_email', 'buddy_email'];
  var missing = [];
  var hasLegacyIdentity = map.employee_name && map.email && map.role;
  var hasIntakeIdentity = map.first_name && map.personal_email && map.job_title;

  if (!hasLegacyIdentity && !hasIntakeIdentity) {
    missing.push('employee_name/email/role or first_name/personal_email/job_title');
  }

  var requiredKeys = hasLegacyIdentity ? legacyRequiredKeys : intakeRequiredKeys;
  for (var i = 0; i < requiredKeys.length; i += 1) {
    if (!map[requiredKeys[i]]) {
      missing.push(requiredKeys[i]);
    }
  }
  if (missing.length > 0) {
    throw new Error('Onboarding sheet schema invalid. Missing required header(s): ' + missing.join(', '));
  }

  var schemaClient = new SheetClient();
  schemaClient.validateWorkbookSchemas();
}

function toRowObject_(rowValues, headerMap) {
  var row = {};
  Object.keys(headerMap).forEach(function (key) {
    row[key] = rowValues[headerMap[key] - 1];
  });
  return row;
}

function setStatus_(sheet, rowIndex, headerMap, statusValue) {
  if (!headerMap.status) {
    return;
  }
  sheet.getRange(rowIndex, headerMap.status).setValue(statusValue);
  setValueIfColumnExists_(sheet, rowIndex, headerMap, 'last_updated_at', new Date());
}

function setValueIfColumnExists_(sheet, rowIndex, headerMap, key, value) {
  if (headerMap[key]) {
    sheet.getRange(rowIndex, headerMap[key]).setValue(value);
  }
}

function normalizeKey_(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function parseDateValue_(value) {
  if (value instanceof Date) {
    return value;
  }
  var parsed = new Date(value);
  if (isNaN(parsed.getTime())) {
    throw new Error('Invalid start_date value: ' + value);
  }
  return parsed;
}

function formatDateKey_(dateValue) {
  var date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (isNaN(date.getTime())) {
    return '';
  }
  return date.toISOString().slice(0, 10);
}

function getFirstName_(fullName) {
  return String(fullName || '').trim().split(/\s+/)[0] || '';
}

function normalizeOnboardingRowData_(rowData) {
  var firstName = String(rowData.first_name || '').trim();
  var lastName = String(rowData.last_name || '').trim();
  var employeeName = String(rowData.employee_name || '').trim();
  if (!employeeName) {
    employeeName = [firstName, lastName].filter(function (value) { return value !== ''; }).join(' ').trim();
  }

  var onboardingId = String(rowData.onboarding_id || '').trim();
  var startDate = rowData.start_date;
  var primaryEmail = String(rowData.email || rowData.work_email || rowData.personal_email || '').trim().toLowerCase();

  if (!onboardingId) {
    onboardingId = buildDeterministicOnboardingId_(primaryEmail, employeeName, startDate);
  }

  return {
    onboarding_id: onboardingId,
    employee_name: employeeName,
    email: primaryEmail,
    role: String(rowData.role || rowData.job_title || '').trim(),
    start_date: startDate,
    manager_email: String(rowData.manager_email || '').trim(),
    buddy_email: String(rowData.buddy_email || '').trim(),
    buddy_slack_id: String(rowData.buddy_slack_id || '').trim(),
    brand: String(rowData.brand || rowData.department || '').trim(),
    region: String(rowData.region || rowData.country || '').trim()
  };
}

function buildDeterministicOnboardingId_(email, employeeName, startDate) {
  var hash = String(computeHash([email, employeeName, formatDateKey_(startDate)]) || '').replace(/[^a-zA-Z0-9]/g, '');
  return 'ONB-' + (hash.slice(0, 10) || generateId('ONB'));
}

function processChecklistOnlyOnboardingRow_(sheetClient, auditLogger, normalizedRowData) {
  var startDate = parseDateValue_(normalizedRowData.start_date);
  generateChecklistTasks_(sheetClient, auditLogger, normalizedRowData.onboarding_id, normalizedRowData, startDate, new Date());
}


function generateChecklistTasks_(sheetClient, auditLogger, onboardingId, rowData, startDate, triggerTimestamp) {
  sheetClient.ensureSheetWithHeaders(Config.getChecklistSheetName(), CHECKLIST_HEADERS);
  var templateRows = getChecklistTemplateRows_();
  var generatedCount = 0;

  for (var i = 0; i < templateRows.length; i += 1) {
    var template = templateRows[i];
    if (!templateMatchesOnboarding_(template, rowData)) {
      continue;
    }

    var dueDate = computeTemplateDueDate_(template, startDate, triggerTimestamp);
    var checklistRowIndex = sheetClient.appendChecklistTask([
      template.task_id,
      onboardingId,
      template.phase || template.category || 'Unassigned',
      template.task_name,
      template.owner_team,
      template.owner_slack_channel || template.owner_slack_id || '',
      'PENDING',
      dueDate,
      triggerTimestamp || new Date(),
      'system',
      template.notes || ''
    ]);

    dispatchTaskAssignment_(sheetClient, auditLogger, {
      onboardingId: onboardingId,
      taskId: template.task_id,
      taskName: template.task_name,
      ownerTeam: template.owner_team,
      ownerSlackId: template.owner_slack_channel || template.owner_slack_id || '',
      employeeName: rowData.employee_name,
      dueDate: dueDate,
      checklistRowIndex: checklistRowIndex
    });

    generatedCount += 1;
  }

  if (generatedCount === 0) {
    var fallbackTaskId = 'GEN-' + String(onboardingId).replace(/[^a-zA-Z0-9_-]/g, '').slice(-10);
    sheetClient.appendChecklistTask([
      fallbackTaskId,
      onboardingId,
      'Onboarding',
      'Review onboarding details and prepare day-1 checklist',
      'People Ops',
      Config.getPeopleTeamChannelId(),
      'PENDING',
      computeDueDate_(startDate, 0, 1),
      triggerTimestamp || new Date(),
      'system',
      'Auto-generated fallback task because no checklist template matched the onboarding row.'
    ]);
    generatedCount += 1;
  }

  auditLogger.log({
    entityType: 'ChecklistTask',
    entityId: onboardingId,
    action: 'CREATE',
    details: 'Generated ' + generatedCount + ' checklist task(s) from template for onboarding_id=' + onboardingId + '.'
  });
}

function evaluateOnboardingCompletionGate_(sheetClient, onboardingId) {
  var checklistRows = sheetClient.getChecklistRows();
  var missingByPhase = {};

  for (var i = 0; i < checklistRows.length; i += 1) {
    var row = checklistRows[i];
    if (String(row[1]) !== String(onboardingId)) {
      continue;
    }

    var taskStatus = String(row[6] || '').trim().toUpperCase();
    var isDone = taskStatus === STATUS.COMPLETE || taskStatus === 'DONE';
    if (isDone) {
      continue;
    }

    var phase = String(row[2] || 'Unassigned').trim() || 'Unassigned';
    if (!missingByPhase[phase]) {
      missingByPhase[phase] = [];
    }
    missingByPhase[phase].push(String(row[3] || 'Unnamed task'));
  }

  var phases = Object.keys(missingByPhase);
  if (phases.length === 0) {
    return { canComplete: true, blockedReason: '' };
  }

  var phaseSummaries = phases.map(function (phase) {
    return phase + ': ' + missingByPhase[phase].join(', ');
  });

  return {
    canComplete: false,
    blockedReason: 'Cannot mark onboarding COMPLETE. Missing required tasks by phase -> ' + phaseSummaries.join(' | ')
  };
}

function tryCompleteOnboarding_(sheetClient, onboardingSheet, rowIndex, headerMap, onboardingId) {
  var result = evaluateOnboardingCompletionGate_(sheetClient, onboardingId);
  if (!result.canComplete) {
    setStatus_(onboardingSheet, rowIndex, headerMap, STATUS.BLOCKED);
    setBlockedReason_(onboardingSheet, rowIndex, headerMap, result.blockedReason);
    return result;
  }

  setStatus_(onboardingSheet, rowIndex, headerMap, STATUS.COMPLETE);
  setBlockedReason_(onboardingSheet, rowIndex, headerMap, '');
  setValueIfColumnExists_(onboardingSheet, rowIndex, headerMap, 'checklist_completed', true);
  return { canComplete: true, blockedReason: '' };
}

function setBlockedReason_(sheet, rowIndex, headerMap, message) {
  setValueIfColumnExists_(sheet, rowIndex, headerMap, 'blocked_reason', message || '');
}

function getChecklistTemplateRows_() {
  if (typeof CHECKLIST_TASK_TEMPLATE !== 'undefined' && CHECKLIST_TASK_TEMPLATE && CHECKLIST_TASK_TEMPLATE.length) {
    return CHECKLIST_TASK_TEMPLATE;
  }
  return [];
}

function templateMatchesOnboarding_(template, rowData) {
  return matchesRule_(template.brand_rules, rowData.brand) &&
    matchesRule_(template.region_rules, rowData.region) &&
    matchesRule_(template.role_rules, rowData.role);
}

function matchesRule_(rules, candidate) {
  var normalizedCandidate = String(candidate || '').trim().toUpperCase();
  var normalizedRules = (rules || ['*']).map(function (rule) {
    return String(rule || '').trim().toUpperCase();
  });

  if (normalizedRules.indexOf('*') > -1) {
    return true;
  }
  return normalizedRules.indexOf(normalizedCandidate) > -1;
}



function notifyOnboardingAssignment_(sheetClient, auditLogger, slackClient, details) {
  var onboardingId = String(details.onboardingId || '').trim();
  if (!onboardingId) {
    return;
  }

  var managerSlackId = String(details.managerSlackId || '').trim();
  var buddySlackId = String(details.buddySlackId || '').trim();
  if (!managerSlackId && !buddySlackId) {
    return;
  }

  var notificationHash = computeHash([
    'ONBOARDING_ASSIGNMENT_DM',
    onboardingId,
    managerSlackId,
    buddySlackId
  ]);

  var duplicate = sheetClient.checkDuplicate(Config.getAuditSheetName(), 'event_hash', notificationHash);
  if (duplicate > -1) {
    return;
  }

  var recipients = [];
  if (managerSlackId) {
    slackClient.postMessage(managerSlackId, BlockKit.assignmentNotificationDM({
      recipientRole: 'Manager',
      employeeName: details.employeeName,
      buddyLabel: details.buddyLabel,
      teamLabel: details.teamLabel
    }));
    recipients.push('manager');
  }

  if (buddySlackId) {
    slackClient.postMessage(buddySlackId, BlockKit.assignmentNotificationDM({
      recipientRole: 'Buddy',
      employeeName: details.employeeName,
      buddyLabel: details.buddyLabel,
      teamLabel: details.teamLabel
    }));
    recipients.push('buddy');
  }

  sheetClient.appendAuditIfNotExists(notificationHash, [
    generateId('AUD'),
    new Date(),
    'system',
    'Onboarding',
    onboardingId,
    'NOTIFY',
    'Assignment DM sent to ' + recipients.join(' and ') + '.',
    notificationHash
  ]);
}


function dispatchTaskAssignment_(sheetClient, auditLogger, task) {
  var slackClient = new SlackClient(auditLogger);
  var destination = resolveTaskOwnerDestination_(task.ownerTeam, task.ownerSlackId);
  var dueDateLabel = formatDateKey_(task.dueDate);
  var rowLink = sheetClient.getSheetRowLink(Config.getChecklistSheetName(), task.checklistRowIndex);
  var notificationHash = computeHash([
    'TASK_ASSIGNMENT',
    task.onboardingId,
    task.taskId,
    destination.channelId,
    dueDateLabel
  ]);

  var duplicate = sheetClient.checkDuplicate(Config.getAuditSheetName(), 'event_hash', notificationHash);
  if (duplicate > -1) {
    return;
  }

  slackClient.postMessage(destination.channelId, BlockKit.checklistAssignment({
    employeeName: task.employeeName,
    taskName: task.taskName,
    dueDate: dueDateLabel,
    ownerLabel: destination.ownerLabel,
    rowLink: rowLink
  }));

  sheetClient.appendAuditIfNotExists(notificationHash, [
    generateId('AUD'),
    new Date(),
    'system',
    'ChecklistTask',
    task.onboardingId + ':' + task.taskId,
    'NOTIFY',
    'Assignment sent to ' + destination.channelId + ' via ' + destination.rule + '.',
    notificationHash
  ]);
}

function resolveTaskOwnerDestination_(ownerTeam, ownerSlackId) {
  var cleanedDestination = String(ownerSlackId || '').trim();
  if (/^[CDGU][A-Z0-9]{8,}$/.test(cleanedDestination)) {
    return {
      channelId: cleanedDestination,
      ownerLabel: cleanedDestination,
      rule: 'direct_slack_id'
    };
  }

  var teamKey = String(ownerTeam || '').trim().toUpperCase();
  var byTeam = {
    ADMIN: Config.getAdminTeamChannelId,
    FINANCE: Config.getFinanceTeamChannelId,
    HR: Config.getHrTeamChannelId,
    IT: Config.getItTeamChannelId,
    LEGAL: Config.getLegalTeamChannelId,
    OPERATIONS: Config.getOperationsTeamChannelId,
    PEOPLE: Config.getPeopleTeamChannelId,
    'PEOPLE OPS': Config.getPeopleTeamChannelId
  };

  var resolver = byTeam[teamKey] || null;
  if (!resolver && teamKey.indexOf('FINANCE') > -1) {
    resolver = Config.getFinanceTeamChannelId;
  } else if (!resolver && teamKey.indexOf('ADMIN') > -1) {
    resolver = Config.getAdminTeamChannelId;
  } else if (!resolver && teamKey.indexOf('IT') > -1) {
    resolver = Config.getItTeamChannelId;
  } else if (!resolver && (teamKey.indexOf('PEOPLE') > -1 || teamKey.indexOf('HR') > -1)) {
    resolver = Config.getPeopleTeamChannelId;
  }

  if (resolver) {
    return {
      channelId: resolver.call(Config),
      ownerLabel: cleanedDestination || ownerTeam || 'Team',
      rule: 'team_channel_map'
    };
  }

  return {
    channelId: Config.getDefaultAssignmentsChannelId(),
    ownerLabel: cleanedDestination || ownerTeam || 'Team',
    rule: 'default_channel'
  };
}

if (typeof module !== 'undefined') {
  module.exports = {
    onChangeHandler: onChangeHandler,
    processOnboardingRow_: processOnboardingRow_,
    evaluateOnboardingCompletionGate_: evaluateOnboardingCompletionGate_,
    tryCompleteOnboarding_: tryCompleteOnboarding_,
    templateMatchesOnboarding_: templateMatchesOnboarding_,
    resolveTaskOwnerDestination_: resolveTaskOwnerDestination_,
    notifyOnboardingAssignment_: notifyOnboardingAssignment_,
    WORKFLOW_EVENT_TYPES: WORKFLOW_EVENT_TYPES,
    buildWorkflowContext_: buildWorkflowContext_
  };
}
