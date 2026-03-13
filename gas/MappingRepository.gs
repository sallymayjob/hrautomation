/* global */
/** @fileoverview Mapping repository adapter for sheet-safe mapping utilities. */

function MappingRepository(sheetClient) {
  this.sheetClient = sheetClient;
}

MappingRepository.prototype.getHeaderMap = function (sheet) {
  return this.sheetClient.getHeaderMap_(sheet);
};

MappingRepository.prototype.normalizeKey = function (value) {
  return this.sheetClient.normalizeKey_(value);
};

if (typeof module !== 'undefined') module.exports = { MappingRepository: MappingRepository };
