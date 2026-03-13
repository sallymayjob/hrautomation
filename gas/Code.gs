/* global SheetClient, computeHash, Config, OnboardingRepository, processOnboardingRow_, hydrateOnboardingDefaults_, validateOnboardingSchema_, AuditLogger, AuditRepository */
/**
 * @fileoverview Event ingress handlers for onboarding processing.
 */

var WORKFLOW_NAME = 'onboarding_workflow';

var WORKFLOW_EVENT_TYPES = {
  WORKFLOW_CALLED: 'WORKFLOW_CALLED',
  WORKFLOW_STARTED: 'WORKFLOW_STARTED',
  WORKFLOW_ENDED: 'WORKFLOW_ENDED'
};

function onChangeHandler(e) {
  var ingressEvent = normalizeIngressPayload_(e, { source: 'trigger', eventType: 'sheet_change' });
  return routeIngressEvent_(ingressEvent);
}

function runOnboardingManual() {
  var ingressEvent = normalizeIngressPayload_({}, { source: 'manual_run', eventType: 'manual_run' });
  return routeIngressEvent_(ingressEvent);
}

function routeIngressEvent_(ingressEvent) {
  if (ingressEvent.source === 'slack_workflow') {
    // ACK immediately for Slack-style ingress and defer governed work.
    return buildControllerResponse_(ingressEvent.traceId, 'accepted', { accepted: true });
  }

  var sheet = ingressEvent.sheet;
  if (!sheet || sheet.getName() !== Config.getOnboardingSheetName()) {
    return buildControllerResponse_(ingressEvent.traceId, 'skipped', { skipped: true });
  }

  var sheetClient = new SheetClient();
  var onboardingRepository = new OnboardingRepository(sheetClient);
  var headerMap = onboardingRepository.getHeaderMap(sheet);
  validateOnboardingSchema_(sheet, headerMap);

  var auditRepository = new AuditRepository(sheetClient, new AuditLogger(sheetClient));
  emitIngressLifecycle_(auditRepository, ingressEvent.workflowContext, WORKFLOW_EVENT_TYPES.WORKFLOW_CALLED, '');

  var lastRow = sheet.getLastRow();
  for (var rowIndex = 2; rowIndex <= lastRow; rowIndex += 1) {
    hydrateOnboardingDefaults_(sheet, rowIndex, headerMap, onboardingRepository);
    if (!shouldProcessOnboardingRow_(sheet, rowIndex, headerMap)) {
      continue;
    }
    var onboardingId = String(sheet.getRange(rowIndex, headerMap.onboarding_id).getValue() || '').trim();
    var rowWorkflowContext = cloneWorkflowContext_(ingressEvent.workflowContext);
    rowWorkflowContext.onboardingId = onboardingId;
    processOnboardingRow_(sheet, rowIndex, rowWorkflowContext);
  }

  return buildControllerResponse_(ingressEvent.traceId, 'processed', { processed: true });
}


function buildControllerResponse_(traceId, status, data) {
  return {
    ok: true,
    trace_id: traceId,
    status: String(status || ''),
    data: data || {},
    error: null
  };
}

function normalizeIngressPayload_(e, overrides) {
  var payload = (e && (e.slackPayload || e.payload || e.metadata)) || {};
  var mergedOverrides = overrides || {};
  var source = String(mergedOverrides.source || payload.source || (e && e.triggerUid ? 'trigger' : 'manual_run'));
  var metadata = extractWorkflowMetadata_(e, source);
  var traceId = buildTraceId_(metadata, source);

  return {
    source: source,
    eventType: String(mergedOverrides.eventType || payload.event_type || (e && e.changeType) || 'sheet_change'),
    traceId: traceId,
    sheet: e && e.source && e.source.getActiveSheet ? e.source.getActiveSheet() : null,
    workflowContext: {
      workflowName: WORKFLOW_NAME,
      workflowRunKey: traceId,
      actor: metadata.requester,
      sourceTrigger: metadata.sourceTrigger,
      onboardingId: ''
    },
    payload: payload
  };
}

function buildTraceId_(metadata, source) {
  return computeHash([
    WORKFLOW_NAME,
    source,
    metadata.requester,
    metadata.ts,
    metadata.workflowId
  ]);
}

function extractWorkflowMetadata_(e, source) {
  var payload = (e && (e.slackPayload || e.payload || e.metadata)) || {};
  var requester = String(payload.requester || payload.user_id || payload.userId || payload.actor || payload.email || 'system');
  var ts = String(payload.ts || payload.trigger_ts || payload.event_ts || payload.message_ts || '0');
  var workflowId = String(payload.workflow_id || payload.workflowId || payload.callback_id || 'onChangeHandler');
  var sourceTrigger = String((e && e.triggerUid) || payload.source_trigger || source || 'on_change');

  return {
    requester: requester,
    ts: ts,
    workflowId: workflowId,
    sourceTrigger: sourceTrigger
  };
}

function shouldProcessOnboardingRow_(sheet, rowIndex, headerMap) {
  if (headerMap.status) {
    var statusValue = String(sheet.getRange(rowIndex, headerMap.status).getValue() || '').trim().toUpperCase();
    return statusValue === 'PENDING';
  }
  if (headerMap.checklist_completed) {
    return !Boolean(sheet.getRange(rowIndex, headerMap.checklist_completed).getValue());
  }
  return true;
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

function emitIngressLifecycle_(auditRepository, workflowContext, eventType, onboardingId) {
  auditRepository.logLifecycle({
    workflow_name: workflowContext.workflowName,
    workflow_run_key: workflowContext.workflowRunKey,
    event_type: eventType,
    actor: workflowContext.actor,
    source_trigger: workflowContext.sourceTrigger,
    onboarding_id: onboardingId || ''
  });
}

if (typeof module !== 'undefined') {
  var controller = require('./OnboardingController.gs');
  var repos = require('./OnboardingRepositories.gs');
  processOnboardingRow_ = controller.processOnboardingRow_;
  hydrateOnboardingDefaults_ = controller.hydrateOnboardingDefaults_;
  validateOnboardingSchema_ = controller.validateOnboardingSchema_;
  OnboardingRepository = repos.OnboardingRepository;
  AuditRepository = repos.AuditRepository;

  module.exports = {
    onChangeHandler: onChangeHandler,
    runOnboardingManual: runOnboardingManual,
    routeIngressEvent_: routeIngressEvent_,
    normalizeIngressPayload_: normalizeIngressPayload_,
    processOnboardingRow_: controller.processOnboardingRow_,
    evaluateOnboardingCompletionGate_: controller.evaluateOnboardingCompletionGate_,
    tryCompleteOnboarding_: controller.tryCompleteOnboarding_,
    templateMatchesOnboarding_: controller.templateMatchesOnboarding_,
    resolveTaskOwnerDestination_: controller.resolveTaskOwnerDestination_,
    notifyOnboardingAssignment_: controller.notifyOnboardingAssignment_,
    WORKFLOW_EVENT_TYPES: WORKFLOW_EVENT_TYPES
  };
}
