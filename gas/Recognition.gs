/* global SheetClient, SlackClient, BlockKit, COL, AuditService, LessonController, ReminderController */
/**
 * @fileoverview Recognition workflow for completed training.
 */

var RecognitionBindings_ = null;
if (typeof module !== 'undefined') {
  RecognitionBindings_ = require('./AuditService.gs');
}

function getAuditServiceCtor_() {
  if (typeof AuditService !== 'undefined' && AuditService) {
    return AuditService;
  }
  return RecognitionBindings_ ? RecognitionBindings_.AuditService : null;
}

function TrainingRecognitionRepository(sheetClient) {
  this.sheetClient = sheetClient;
}

TrainingRecognitionRepository.prototype.findTrainingById = function (trainingId) {
  var parts = String(trainingId || '').split(':');
  if (parts.length !== 2) {
    return null;
  }
  var found = this.sheetClient.findTrainingByEmployeeAndModule(parts[0], parts[1]);
  if (!found) {
    return null;
  }
  return {
    employeeId: parts[0],
    moduleCode: parts[1],
    row: found.values
  };
};

TrainingRecognitionRepository.prototype.findOnboardingByEmployeeId = function (employeeId) {
  return this.sheetClient.findOnboardingByEmployeeId(employeeId);
};

TrainingRecognitionRepository.prototype.markRecognitionPosted = function (employeeId, moduleCode) {
  return this.sheetClient.updateTrainingRecognitionMetadata(employeeId, moduleCode, true, new Date());
};

function handleTrainingComplete(trainingId) {
  var sheetClient = new SheetClient();
  var trainingRepository = new TrainingRecognitionRepository(sheetClient);
  var resolved = trainingRepository.findTrainingById(trainingId);
  if (!resolved) {
    throw new Error('Training record not found for ' + trainingId);
  }
  if (Boolean(resolved.row[COL.TRAINING.CELEBRATION_POSTED - 1])) return false;

  routeRecognitionOrchestration_(resolved);

  var slackClient = new SlackClient();
  var onboarding = trainingRepository.findOnboardingByEmployeeId(resolved.employeeId);
  var employeeName = onboarding ? onboarding.values[COL.ONBOARDING.FULL_NAME - 1] : resolved.employeeId;

  slackClient.postMessage('#hr-alerts', BlockKit.recognitionPost({
    employeeName: employeeName,
    moduleName: resolved.row[COL.TRAINING.MODULE_NAME - 1]
  }));

  trainingRepository.markRecognitionPosted(resolved.employeeId, resolved.moduleCode);

  var AuditServiceCtor = getAuditServiceCtor_();
  if (AuditServiceCtor) {
    var auditService = new AuditServiceCtor(sheetClient);
    auditService.logRecognitionAction({
      entityId: String(trainingId),
      action: 'UPDATE',
      details: 'Recognition posted'
    });
  }

  return true;
}

function routeRecognitionOrchestration_(resolvedTraining) {
  if (typeof LessonController !== 'undefined' && LessonController) {
    if (typeof LessonController.handleCompletionRecognition === 'function') {
      LessonController.handleCompletionRecognition(resolvedTraining);
      return;
    }
    if (typeof LessonController.markCompletionRecognized === 'function') {
      LessonController.markCompletionRecognized(resolvedTraining);
      return;
    }
  }

  if (typeof ReminderController !== 'undefined' && ReminderController) {
    if (typeof ReminderController.handleCompletionRecognition === 'function') {
      ReminderController.handleCompletionRecognition(resolvedTraining);
    }
  }
}

if (typeof module !== 'undefined') {
  module.exports = {
    handleTrainingComplete: handleTrainingComplete,
    TrainingRecognitionRepository: TrainingRecognitionRepository,
    routeRecognitionOrchestration_: routeRecognitionOrchestration_
  };
}
