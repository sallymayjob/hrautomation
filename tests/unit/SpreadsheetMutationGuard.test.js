const fs = require('fs');
const path = require('path');

const GAS_DIR = path.resolve(__dirname, '../../gas');
const REPO_FILE_PATTERN = /(Repository|Repositories)\.gs$/;
const EXPLICIT_ALLOWED_FILES = new Set(['SheetClient.gs']);
const FORBIDDEN_MUTATION_PATTERN = /(\.setValue\s*\()|(\.setValues\s*\()|(\.appendRow\s*\()|(\.deleteRow\s*\()|(\.insert(?:Row|Rows|Column|Columns|Sheet|Sheets)\s*\()|(\.clear(?:Content|Contents|Format|Formats|DataValidations|Note|Notes)?\s*\()/g;
const ALLOWED_WRAPPER_CALL_PATTERNS = [/\brepository\.appendRow\s*\(/];

function getGasFiles() {
  return fs.readdirSync(GAS_DIR)
    .filter((entry) => entry.endsWith('.gs'))
    .map((entry) => path.join(GAS_DIR, entry));
}

describe('Spreadsheet mutation guard', () => {
  test('direct SpreadsheetApp mutating calls stay in repository/infrastructure files only', () => {
    const disallowedUsages = [];

    getGasFiles().forEach((filePath) => {
      const fileName = path.basename(filePath);
      if (REPO_FILE_PATTERN.test(fileName) || EXPLICIT_ALLOWED_FILES.has(fileName)) {
        return;
      }

      const source = fs.readFileSync(filePath, 'utf8');
      const lines = source.split(/\r?\n/);

      lines.forEach((line, index) => {
        FORBIDDEN_MUTATION_PATTERN.lastIndex = 0;
        if (FORBIDDEN_MUTATION_PATTERN.test(line)) {
          var isAllowedWrapperCall = ALLOWED_WRAPPER_CALL_PATTERNS.some((pattern) => pattern.test(line));
          if (!isAllowedWrapperCall) {
            disallowedUsages.push(fileName + ':' + (index + 1) + ' -> ' + line.trim());
          }
        }
      });
    });

    expect(disallowedUsages).toEqual([]);
  });
});
