/* global SheetClient, SlackClient, AuditLogger, BlockKit, computeHash, generateId, CHECKLIST_TASK_TEMPLATE, Config, console, OnboardingRepository, TrainingRepository, AuditRepository */
/**
 * @fileoverview Onboarding business mutations and orchestration.
 */

var CHECKLIST_HEADERS = [
  'task_id', 'onboarding_id', 'phase', 'task_name', 'owner_team', 'owner_slack_channel',
  'status', 'due_date', 'updated_at', 'updated_by', 'notes'
];

var STATUS = {
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  BLOCKED: 'BLOCKED',
  COMPLETE: 'COMPLETE'
};


var RepositoryBindings_ = null;
if (typeof module !== 'undefined') {
  RepositoryBindings_ = require('./OnboardingRepositories.gs');
}

function getRepositoryCtor_(name, globalCtor) {
  if (globalCtor) {
    return globalCtor;
  }
  return RepositoryBindings_ ? RepositoryBindings_[name] : null;
}

var ROLE_MAPPINGS = {
  DEFAULT: { probationDays: 90, resources: [{ moduleCode: 'ORG-101', moduleName: 'Company Orientation', dueOffsetDays: 7 }, { moduleCode: 'SEC-101', moduleName: 'Security Awareness', dueOffsetDays: 14 }] },
  ENGINEER: { probationDays: 90, resources: [{ moduleCode: 'ENG-101', moduleName: 'Engineering Onboarding', dueOffsetDays: 5 }, { moduleCode: 'SEC-101', moduleName: 'Security Awareness', dueOffsetDays: 14 }] },
  MANAGER: { probationDays: 120, resources: [{ moduleCode: 'MGR-101', moduleName: 'People Leadership Essentials', dueOffsetDays: 10 }, { moduleCode: 'SEC-101', moduleName: 'Security Awareness', dueOffsetDays: 14 }] }
};

function processOnboardingRow_(sheet, rowIndex, workflowContext, repositories) {
  var deps = repositories || createOnboardingRepositories_();
  var runContext = workflowContext || {};
  emitLifecycleEvent_(deps.auditRepository, runContext, 'WORKFLOW_STARTED', runContext.onboardingId || '');
  var headerMap = deps.onboardingRepository.getHeaderMap(sheet);
  validateOnboardingSchema_(sheet, headerMap);

  try {
    var rowData = deps.onboardingRepository.getRowObject(sheet, rowIndex, headerMap);
    var normalizedRowData = normalizeOnboardingRowData_(rowData);

    if (!headerMap.status) {
      processChecklistOnlyOnboardingRow_(deps.onboardingRepository, deps.auditRepository, normalizedRowData);
      return;
    }

    var rowHash = computeHash([normalizedRowData.email, formatDateKey_(normalizedRowData.start_date), normalizedRowData.role, normalizedRowData.manager_email]);
    deps.onboardingRepository.setValueIfPresent(sheet, rowIndex, headerMap, 'row_hash', rowHash);

    var duplicateRow = headerMap.row_hash ? deps.onboardingRepository.findDuplicateByRowHash(rowHash, rowIndex) : -1;
    if (duplicateRow > -1) {
      deps.onboardingRepository.setStatus(sheet, rowIndex, headerMap, STATUS.BLOCKED);
      deps.onboardingRepository.setBlockedReason(sheet, rowIndex, headerMap, 'Duplicate onboarding row found. Matched row index ' + duplicateRow + '.');
      deps.auditRepository.log({ entityType: 'Onboarding', entityId: String(normalizedRowData.onboarding_id || rowIndex), action: 'UPDATE', details: 'Marked as duplicate. Matched row index ' + duplicateRow + '.' });
      return;
    }

    requireMandatoryStakeholders_(normalizedRowData);

    var managerSlackId = lookupSlackIdByEmail_(deps.slackClient, normalizedRowData.manager_email);
    deps.onboardingRepository.setValueIfPresent(sheet, rowIndex, headerMap, 'manager_slack_id', managerSlackId);

    var buddySlackId = String(normalizedRowData.buddy_slack_id || '').trim();
    if (!buddySlackId) {
      buddySlackId = lookupSlackIdByEmail_(deps.slackClient, normalizedRowData.buddy_email);
      deps.onboardingRepository.setValueIfPresent(sheet, rowIndex, headerMap, 'buddy_slack_id', buddySlackId);
    }

    var roleMapping = getRoleMapping_(normalizedRowData.role);
    var startDate = parseDateValue_(normalizedRowData.start_date);
    var employeeSlackId = lookupSlackIdByEmail_(deps.slackClient, normalizedRowData.email);
    if (!employeeSlackId) {
      throw new Error('Unable to resolve employee Slack ID for email: ' + normalizedRowData.email);
    }

    deps.slackClient.postMessage(employeeSlackId, BlockKit.welcomeDM({
      firstName: getFirstName_(normalizedRowData.employee_name),
      startDate: formatDateKey_(startDate),
      managerName: normalizedRowData.manager_email || 'TBD'
    }));

    notifyOnboardingAssignment_(deps, {
      onboardingId: normalizedRowData.onboarding_id,
      employeeName: normalizedRowData.employee_name,
      managerSlackId: managerSlackId,
      buddySlackId: buddySlackId,
      buddyLabel: normalizedRowData.buddy_email || buddySlackId || 'Not assigned yet',
      teamLabel: [normalizedRowData.brand, normalizedRowData.region, normalizedRowData.role].filter(function (value) { return String(value || '').trim() !== ''; }).join(' / ') || 'General onboarding'
    });

    writeTrainingAssignments_(deps.trainingRepository, normalizedRowData, roleMapping, startDate);

    var onboardingId = normalizedRowData.onboarding_id || generateId('ONB');
    if (!normalizedRowData.onboarding_id) {
      deps.onboardingRepository.setValueIfPresent(sheet, rowIndex, headerMap, 'onboarding_id', onboardingId);
    }

    generateChecklistTasks_(deps, onboardingId, normalizedRowData, startDate, new Date());
    deps.onboardingRepository.setValueIfPresent(sheet, rowIndex, headerMap, 'dm_sent_at', new Date());
    deps.onboardingRepository.setValueIfPresent(sheet, rowIndex, headerMap, 'processed_at', new Date());
    deps.onboardingRepository.setStatus(sheet, rowIndex, headerMap, STATUS.IN_PROGRESS);
    deps.onboardingRepository.setBlockedReason(sheet, rowIndex, headerMap, '');

    deps.auditRepository.log({
      entityType: 'Onboarding',
      entityId: onboardingId,
      action: 'UPDATE',
      details: 'Onboarding processed successfully for onboarding_id=' + onboardingId + '.'
    });
    runContext.onboardingId = onboardingId;
  } catch (err) {
    deps.onboardingRepository.setStatus(sheet, rowIndex, headerMap, STATUS.BLOCKED);
    deps.onboardingRepository.setBlockedReason(sheet, rowIndex, headerMap, String(err && err.message ? err.message : err));
    deps.onboardingRepository.setValueIfPresent(sheet, rowIndex, headerMap, 'error_message', String(err && err.message ? err.message : err));
    console.error('Onboarding processing failed for row ' + rowIndex + ': ' + err);
    deps.auditRepository.error({ entityType: 'Onboarding', entityId: 'row_' + rowIndex, action: 'UPDATE', details: 'Onboarding processing failed.' }, err);
  } finally {
    emitLifecycleEvent_(deps.auditRepository, runContext, 'WORKFLOW_ENDED', runContext.onboardingId || '');
  }
}

function createOnboardingRepositories_() {
  var sheetClient = new SheetClient();
  var auditLogger = new AuditLogger(sheetClient);
  var OnboardingRepoCtor = getRepositoryCtor_('OnboardingRepository', typeof OnboardingRepository !== 'undefined' ? OnboardingRepository : null);
  var TrainingRepoCtor = getRepositoryCtor_('TrainingRepository', typeof TrainingRepository !== 'undefined' ? TrainingRepository : null);
  var AuditRepoCtor = getRepositoryCtor_('AuditRepository', typeof AuditRepository !== 'undefined' ? AuditRepository : null);

  return {
    onboardingRepository: new OnboardingRepoCtor(sheetClient),
    trainingRepository: new TrainingRepoCtor(sheetClient),
    auditRepository: new AuditRepoCtor(sheetClient, auditLogger),
    slackClient: new SlackClient(auditLogger)
  };
}

function hydrateOnboardingDefaults_(sheet, rowIndex, headerMap, onboardingRepository) {
  var repo = onboardingRepository || new OnboardingRepository(new SheetClient());
  var onboardingId = String(sheet.getRange(rowIndex, headerMap.onboarding_id).getValue() || '').trim();
  if (!onboardingId) {
    repo.setValueIfPresent(sheet, rowIndex, headerMap, 'onboarding_id', generateId('ONB'));
  }

  var statusValue = String(sheet.getRange(rowIndex, headerMap.status).getValue() || '').trim().toUpperCase();
  if (!statusValue) {
    repo.setStatus(sheet, rowIndex, headerMap, STATUS.PENDING);
  }

  if (headerMap.checklist_completed) {
    var checklistCompleted = sheet.getRange(rowIndex, headerMap.checklist_completed).getValue();
    if (checklistCompleted === '' || checklistCompleted === null) {
      repo.setValueIfPresent(sheet, rowIndex, headerMap, 'checklist_completed', false);
    }
  }
}

function emitLifecycleEvent_(auditRepository, workflowContext, eventType, onboardingId) {
  var context = workflowContext || {};
  auditRepository.logLifecycle({
    workflow_name: context.workflowName || 'onboarding_workflow',
    workflow_run_key: context.workflowRunKey || '',
    event_type: eventType,
    actor: context.actor || 'system',
    source_trigger: context.sourceTrigger || 'manual',
    onboarding_id: onboardingId || ''
  });
}

function requireMandatoryStakeholders_(rowData) {
  if (!String(rowData.manager_email || '').trim()) {
    throw new Error('Manager email is required for onboarding so the trainer can be assigned.');
  }
  if (!String(rowData.buddy_email || '').trim()) {
    throw new Error('Buddy email is required for onboarding so a peer can be assigned.');
  }
}

function lookupSlackIdByEmail_(slackClient, email) {
  var lookup = slackClient.lookupUserByEmail(String(email || '').trim());
  return lookup && lookup.user && lookup.user.id ? lookup.user.id : '';
}

function writeTrainingAssignments_(trainingRepository, rowData, roleMapping, startDate) {
  for (var i = 0; i < roleMapping.resources.length; i += 1) {
    var resource = roleMapping.resources[i];
    var dueDate = computeDueDate_(startDate, roleMapping.probationDays, resource.dueOffsetDays);
    trainingRepository.appendAssignment([
      rowData.onboarding_id,
      resource.moduleCode,
      resource.moduleName,
      new Date(),
      dueDate,
      '',
      'ASSIGNED',
      rowData.manager_email || '',
      0,
      '',
      new Date(),
      computeHash([rowData.onboarding_id, resource.moduleCode, formatDateKey_(dueDate)]),
      false
    ]);
  }
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

function processChecklistOnlyOnboardingRow_(onboardingRepository, auditRepository, normalizedRowData) {
  var startDate = parseDateValue_(normalizedRowData.start_date);
  generateChecklistTasks_({ onboardingRepository: onboardingRepository, auditRepository: auditRepository }, normalizedRowData.onboarding_id, normalizedRowData, startDate, new Date());
}

function generateChecklistTasks_(deps, onboardingId, rowData, startDate, triggerTimestamp) {
  deps.onboardingRepository.ensureChecklistHeaders(CHECKLIST_HEADERS);
  var templateRows = getChecklistTemplateRows_();
  var generatedCount = 0;

  for (var i = 0; i < templateRows.length; i += 1) {
    var template = templateRows[i];
    if (!templateMatchesOnboarding_(template, rowData)) {
      continue;
    }

    var dueDate = computeTemplateDueDate_(template, startDate, triggerTimestamp);
    var checklistRowIndex = deps.onboardingRepository.appendChecklistTask([
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

    dispatchTaskAssignment_(deps, {
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
    deps.onboardingRepository.appendChecklistTask([
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

  deps.auditRepository.log({ entityType: 'ChecklistTask', entityId: onboardingId, action: 'CREATE', details: 'Generated ' + generatedCount + ' checklist task(s) from template for onboarding_id=' + onboardingId + '.' });
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

function evaluateOnboardingCompletionGate_(onboardingRepository, onboardingId) {
  var checklistRows = onboardingRepository.getChecklistRows();
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
  return { canComplete: false, blockedReason: 'Cannot mark onboarding COMPLETE. Missing required tasks by phase -> ' + phaseSummaries.join(' | ') };
}

function tryCompleteOnboarding_(onboardingRepository, onboardingSheet, rowIndex, headerMap, onboardingId) {
  var result = evaluateOnboardingCompletionGate_(onboardingRepository, onboardingId);
  if (!result.canComplete) {
    onboardingRepository.setStatus(onboardingSheet, rowIndex, headerMap, STATUS.BLOCKED);
    onboardingRepository.setBlockedReason(onboardingSheet, rowIndex, headerMap, result.blockedReason);
    return result;
  }
  onboardingRepository.setStatus(onboardingSheet, rowIndex, headerMap, STATUS.COMPLETE);
  onboardingRepository.setBlockedReason(onboardingSheet, rowIndex, headerMap, '');
  onboardingRepository.setValueIfPresent(onboardingSheet, rowIndex, headerMap, 'checklist_completed', true);
  return { canComplete: true, blockedReason: '' };
}

function notifyOnboardingAssignment_(deps, details) {
  var onboardingId = String(details.onboardingId || '').trim();
  if (!onboardingId) {
    return;
  }
  var managerSlackId = String(details.managerSlackId || '').trim();
  var buddySlackId = String(details.buddySlackId || '').trim();
  if (!managerSlackId && !buddySlackId) {
    return;
  }

  var notificationHash = computeHash(['ONBOARDING_ASSIGNMENT_DM', onboardingId, managerSlackId, buddySlackId]);
  if (deps.auditRepository.isDuplicateEvent(notificationHash)) {
    return;
  }

  var recipients = [];
  if (managerSlackId) {
    deps.slackClient.postMessage(managerSlackId, BlockKit.assignmentNotificationDM({ recipientRole: 'Manager', employeeName: details.employeeName, buddyLabel: details.buddyLabel, teamLabel: details.teamLabel }));
    recipients.push('manager');
  }
  if (buddySlackId) {
    deps.slackClient.postMessage(buddySlackId, BlockKit.assignmentNotificationDM({ recipientRole: 'Buddy', employeeName: details.employeeName, buddyLabel: details.buddyLabel, teamLabel: details.teamLabel }));
    recipients.push('buddy');
  }

  deps.auditRepository.logOnce(notificationHash, deps.auditRepository.newAuditRow('Onboarding', onboardingId, 'NOTIFY', 'Assignment DM sent to ' + recipients.join(' and ') + '.', notificationHash));
}

function dispatchTaskAssignment_(deps, task) {
  var destination = resolveTaskOwnerDestination_(task.ownerTeam, task.ownerSlackId);
  var dueDateLabel = formatDateKey_(task.dueDate);
  var rowLink = deps.onboardingRepository.getChecklistRowLink(task.checklistRowIndex);
  var notificationHash = computeHash(['TASK_ASSIGNMENT', task.onboardingId, task.taskId, destination.channelId, dueDateLabel]);

  if (deps.auditRepository.isDuplicateEvent(notificationHash)) {
    return;
  }

  deps.slackClient.postMessage(destination.channelId, BlockKit.checklistAssignment({
    employeeName: task.employeeName,
    taskName: task.taskName,
    dueDate: dueDateLabel,
    ownerLabel: destination.ownerLabel,
    rowLink: rowLink
  }));

  deps.auditRepository.logOnce(notificationHash, deps.auditRepository.newAuditRow('ChecklistTask', task.onboardingId + ':' + task.taskId, 'NOTIFY', 'Assignment sent to ' + destination.channelId + ' via ' + destination.rule + '.', notificationHash));
}

function resolveTaskOwnerDestination_(ownerTeam, ownerSlackId) {
  var cleanedDestination = String(ownerSlackId || '').trim();
  if (/^[CDGU][A-Z0-9]{8,}$/.test(cleanedDestination)) {
    return { channelId: cleanedDestination, ownerLabel: cleanedDestination, rule: 'direct_slack_id' };
  }
  var teamKey = String(ownerTeam || '').trim().toUpperCase();
  var resolverName = resolveTeamChannelGetterName_(teamKey);

  if (resolverName && typeof Config[resolverName] === 'function') {
    return { channelId: Config[resolverName](), ownerLabel: cleanedDestination || ownerTeam || 'Team', rule: 'team_channel_map' };
  }
  return { channelId: Config.getDefaultAssignmentsChannelId(), ownerLabel: cleanedDestination || ownerTeam || 'Team', rule: 'default_channel' };
}


function resolveTeamChannelGetterName_(teamKey) {
  var normalizedKey = String(teamKey || '').trim().toUpperCase();
  var routing = (Config && Config.CHANNEL_ROUTING) || {
    ADMIN: 'getAdminTeamChannelId',
    FINANCE: 'getFinanceTeamChannelId',
    HR: 'getHrTeamChannelId',
    IT: 'getItTeamChannelId',
    LEGAL: 'getLegalTeamChannelId',
    OPERATIONS: 'getOperationsTeamChannelId',
    PEOPLE: 'getPeopleTeamChannelId',
    'PEOPLE OPS': 'getPeopleTeamChannelId'
  };
  if (routing[normalizedKey]) {
    return routing[normalizedKey];
  }
  if (normalizedKey.indexOf('FINANCE') > -1) return routing.FINANCE;
  if (normalizedKey.indexOf('ADMIN') > -1) return routing.ADMIN;
  if (normalizedKey.indexOf('IT') > -1) return routing.IT;
  if (normalizedKey.indexOf('LEGAL') > -1) return routing.LEGAL;
  if (normalizedKey.indexOf('OPERATIONS') > -1) return routing.OPERATIONS;
  if (normalizedKey.indexOf('PEOPLE') > -1 || normalizedKey.indexOf('HR') > -1) return routing.PEOPLE;
  return '';
}

function runOnboardingBusinessHours_(onboardingRunner, nowProvider) {
  var current = nowProvider ? nowProvider() : new Date();
  var day = current.getDay();
  var hour = current.getHours();
  var isBusinessDay = day >= 1 && day <= 5;
  var isBusinessHour = hour >= 8 && hour < 18;
  if (!isBusinessDay || !isBusinessHour) {
    return {
      ok: true,
      status: 'skipped',
      data: { skipped: true, reason: 'outside_business_hours' },
      error: null
    };
  }
  return onboardingRunner();
}

function validateOnboardingSchema_(sheet, headerMap) {
  var OnboardingRepoCtor = getRepositoryCtor_('OnboardingRepository', typeof OnboardingRepository !== 'undefined' ? OnboardingRepository : null);
  var map = headerMap || (new OnboardingRepoCtor(new SheetClient())).getHeaderMap(sheet);
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
  new SheetClient().validateWorkbookSchemas();
}

if (typeof module !== 'undefined') {
  module.exports = {
    processOnboardingRow_: processOnboardingRow_,
    hydrateOnboardingDefaults_: hydrateOnboardingDefaults_,
    validateOnboardingSchema_: validateOnboardingSchema_,
    evaluateOnboardingCompletionGate_: evaluateOnboardingCompletionGate_,
    tryCompleteOnboarding_: tryCompleteOnboarding_,
    templateMatchesOnboarding_: templateMatchesOnboarding_,
    resolveTaskOwnerDestination_: resolveTaskOwnerDestination_,
    notifyOnboardingAssignment_: notifyOnboardingAssignment_,
    runOnboardingBusinessHours_: runOnboardingBusinessHours_,
    STATUS: STATUS
  };
}
