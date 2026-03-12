/**
 * @fileoverview Slack Block Kit payload builders returning raw block arrays.
 */

var BlockKit = {
  welcomeDM: function (data) {
    return [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: 'Welcome to the team, ' + (data.firstName || 'there') + '!'
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Start date:* ' + (data.startDate || 'TBC') + '\n*Manager:* ' + (data.managerName || 'TBC')
        }
      }
    ];
  },

  trainingDM: function (data) {
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: ':mortar_board: *Training assigned:* ' + (data.moduleName || 'Mandatory module')
        }
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: 'Due by *' + (data.dueDate || 'TBC') + '*'
          }
        ]
      }
    ];
  },

  reminderDM: function (data) {
    var days = Number(data.daysUntilDue);
    var mode = days === 3 ? 'three_day' : (days === 0 ? 'due_today' : 'overdue');
    var message = mode === 'three_day'
      ? ':hourglass_flowing_sand: Friendly reminder: your training is due in *3 days*.'
      : (mode === 'due_today'
        ? ':warning: Action needed: your training is *due today*.'
        : ':rotating_light: Overdue: your training due date has passed. Please complete it immediately.');

    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: message
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Module:* ' + (data.moduleName || 'Mandatory module') + '\n*Due date:* ' + (data.dueDate || 'Unknown')
        }
      }
    ];
  },

  approvalCard: function (data) {
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Approval request*\n' + (data.requestSummary || 'Please review this request.')
        }
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: ':information_source: Slack responses are read-only. Review in Slack and update approval or status fields in Google Sheets. (Request: ' + (data.requestId || 'REQ-001') + ')'
          }
        ]
      }
    ];
  },

  recognitionPost: function (data) {
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: ':tada: Please celebrate *' + (data.employeeName || 'a teammate') + '* for completing *' + (data.moduleName || 'training') + '*!'
        }
      }
    ];
  },

  birthdayDM: function (data) {
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: ':birthday: Happy Birthday, *' + (data.firstName || 'there') + '*! Have an amazing day.'
        }
      }
    ];
  },





  assignmentNotificationDM: function (data) {
    var teamLabel = data.teamLabel || 'Unassigned team';
    var buddyLabel = data.buddyLabel || 'Not assigned yet';
    var intro = data.recipientRole === 'Buddy'
      ? ':handshake: You have been assigned as a buddy for *' + (data.employeeName || 'a new hire') + '*.'
      : ':busts_in_silhouette: You have a new onboarding assignment to manage.';

    return [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: 'New onboarding assignment'
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: intro
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*New hire:* ' + (data.employeeName || 'Unknown') + '\n*Team to manage:* ' + teamLabel + '\n*Buddy:* ' + buddyLabel
        }
      }
    ];
  },
  checklistAssignment: function (data) {
    var rowLink = data.rowLink ? '<' + data.rowLink + '|Open task row>' : 'Row link unavailable';
    return [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: ':clipboard: New onboarding task assignment'
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Employee:* ' + (data.employeeName || 'Unknown') + '\n*Task:* ' + (data.taskName || 'Untitled') + '\n*Due date:* ' + (data.dueDate || 'TBD')
        }
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: '*Owner:* ' + (data.ownerLabel || 'Unassigned') + ' • ' + rowLink
          }
        ]
      }
    ];
  },

  anniversaryDM: function (data) {
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: ':sparkles: Happy work anniversary, *' + (data.firstName || 'there') + '*! Congrats on *' + (data.years || 1) + ' year(s)* with us.'
        }
      }
    ];
  }
};

if (typeof module !== 'undefined') module.exports = { BlockKit: BlockKit };
