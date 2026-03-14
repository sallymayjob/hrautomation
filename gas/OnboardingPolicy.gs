/* global Config */
/** @fileoverview Business policy helpers for onboarding workflow. */

var ONBOARDING_STATUS = { PENDING: 'PENDING', IN_PROGRESS: 'IN_PROGRESS', BLOCKED: 'BLOCKED', COMPLETE: 'COMPLETE' };

function runOnboardingBusinessHours_(onboardingRunner, nowProvider) {
  var current = nowProvider ? nowProvider() : new Date();
  var day = current.getDay(); var hour = current.getHours();
  var isBusinessDay = day >= 1 && day <= 5; var isBusinessHour = hour >= 8 && hour < 18;
  if (!isBusinessDay || !isBusinessHour) return { ok: true, status: 'skipped', data: { skipped: true, reason: 'outside_business_hours' }, error: null };
  return onboardingRunner();
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
    ADMIN: 'getAdminTeamChannelId', FINANCE: 'getFinanceTeamChannelId', HR: 'getHrTeamChannelId', IT: 'getItTeamChannelId', LEGAL: 'getLegalTeamChannelId', OPERATIONS: 'getOperationsTeamChannelId', PEOPLE: 'getPeopleTeamChannelId', 'PEOPLE OPS': 'getPeopleTeamChannelId'
  };
  if (routing[normalizedKey]) return routing[normalizedKey];
  if (normalizedKey.indexOf('FINANCE') > -1) return routing.FINANCE;
  if (normalizedKey.indexOf('ADMIN') > -1) return routing.ADMIN;
  if (normalizedKey.indexOf('IT') > -1) return routing.IT;
  if (normalizedKey.indexOf('LEGAL') > -1) return routing.LEGAL;
  if (normalizedKey.indexOf('OPERATIONS') > -1) return routing.OPERATIONS;
  if (normalizedKey.indexOf('PEOPLE') > -1 || normalizedKey.indexOf('HR') > -1) return routing.PEOPLE;
  return '';
}

if (typeof module !== 'undefined') module.exports = { ONBOARDING_STATUS: ONBOARDING_STATUS, runOnboardingBusinessHours_: runOnboardingBusinessHours_, resolveTaskOwnerDestination_: resolveTaskOwnerDestination_, resolveTeamChannelGetterName_: resolveTeamChannelGetterName_ };
