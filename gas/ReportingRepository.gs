/* global */
/**
 * @fileoverview Repository for Reporting sheet mutations.
 */

function ReportingRepository(sheetClient) {
  this.sheetClient = sheetClient;
}

ReportingRepository.prototype.replaceSummarySheet = function (sheetName, headers, rows) {
  var self = this;
  return this.sheetClient.safeWrite_(sheetName, function () {
    var sheet = self.sheetClient.ensureSheetWithHeaders(sheetName, headers);
    var existingRowCount = Number(sheet.getLastRow() || 0);

    if (existingRowCount > 1) {
      sheet.getRange(2, 1, existingRowCount - 1, headers.length).clearContent();
    }

    if (rows && rows.length > 0) {
      sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
    }
    return true;
  }, { operation: 'replaceSummarySheet', sheetName: sheetName });
};

if (typeof module !== 'undefined') {
  module.exports = {
    ReportingRepository: ReportingRepository
  };
}
