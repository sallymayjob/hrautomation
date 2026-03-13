function mockGasGlobals() {
  global.SpreadsheetApp = { openById: jest.fn() };
  global.UrlFetchApp = { fetch: jest.fn() };
  global.Utilities = { formatDate: jest.fn(), getUuid: jest.fn(), computeDigest: jest.fn(), DigestAlgorithm: {}, Charset: {} };
  global.PropertiesService = { getScriptProperties: jest.fn() };
  global.Logger = { log: jest.fn() };
  global.ScriptApp = { newTrigger: jest.fn() };
}

describe('BlockKit', () => {
  beforeEach(() => {
    jest.resetModules();
    mockGasGlobals();
  });

  test('builds key block payload variants', () => {
    const { BlockKit } = require('../../gas/BlockKit.gs');
    expect(BlockKit.welcomeDM({ firstName: 'Sam' })[0].text.text).toContain('Sam');
    expect(BlockKit.trainingDM({ moduleName: 'Policy', dueDate: '2026-01-02' })[1].elements[0].text).toContain('2026-01-02');
    expect(BlockKit.reminderDM({ daysUntilDue: 3 })[0].text.text).toContain('3 days');
    expect(BlockKit.reminderDM({ daysUntilDue: 0 })[0].text.text).toContain('due today');
    expect(BlockKit.reminderDM({ daysUntilDue: -1 })[0].text.text).toContain('Overdue');
  });

  test('builds approval and celebration messages', () => {
    const { BlockKit } = require('../../gas/BlockKit.gs');
    const approvalCard = BlockKit.approvalCard({ requestId: 'REQ-9' });
    expect(approvalCard[1].type).toBe('context');
    expect(approvalCard[1].elements[0].text).toContain('read-only');
    expect(approvalCard[1].elements[0].text).toContain('REQ-9');
    expect(BlockKit.recognitionPost({ employeeName: 'Alex' })[0].text.text).toContain('Alex');
    expect(BlockKit.birthdayDM({ firstName: 'Jo' })[0].text.text).toContain('Happy Birthday');
    expect(BlockKit.anniversaryDM({ firstName: 'Jo', years: 2 })[0].text.text).toContain('2 year');
    const assignment = BlockKit.checklistAssignment({ employeeName: 'Alex Doe', taskName: 'Create account', dueDate: '2026-01-09', ownerLabel: '@it-helpdesk', rowLink: 'https://example.com' });
    expect(assignment[1].text.text).toContain('Alex Doe');
    expect(assignment[2].elements[0].text).toContain('Open task row');

    const managerNotification = BlockKit.assignmentNotificationDM({ recipientRole: 'Manager', employeeName: 'Alex Doe', teamLabel: 'Retail / NZ / Manager', buddyLabel: 'buddy@x.com' });
    expect(managerNotification[2].text.text).toContain('Retail / NZ / Manager');
  });

  test('builds proposal and approval workflow cards with display fields', () => {
    const { BlockKit } = require('../../gas/BlockKit.gs');
    const payload = {
      trace_id: 'TRACE-123',
      actor: 'manager@example.com',
      entity_key: 'employee:123:module:SEC101',
      proposed_diff_version: 'v5',
      approval_status: 'PENDING'
    };

    const proposalSummary = BlockKit.proposalSummaryCard(payload);
    expect(proposalSummary[1].text.text).toContain('TRACE-123');
    expect(proposalSummary[1].text.text).toContain('manager@example.com');
    expect(proposalSummary[1].text.text).toContain('employee:123:module:SEC101');
    expect(proposalSummary[1].text.text).toContain('v5');
    expect(proposalSummary[1].text.text).toContain('PENDING');

    const approvalRequest = BlockKit.approvalRequestCard(payload);
    expect(approvalRequest[0].text.text).toContain('Approval request');
    expect(approvalRequest[1].text.text).toContain('TRACE-123');

    const approvalDecision = BlockKit.approvalDecisionCard(payload);
    expect(approvalDecision[0].text.text).toContain('Approval decision');
    expect(approvalDecision[1].text.text).toContain('employee:123:module:SEC101');

    const clarificationPrompt = BlockKit.clarificationPromptCard(payload);
    expect(clarificationPrompt[0].text.text).toContain('Clarification needed');
    expect(clarificationPrompt[1].text.text).toContain('v5');
  });
});
