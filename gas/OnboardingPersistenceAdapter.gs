/** @fileoverview Persistence adapter boundaries for onboarding workflow. */

function onboardingCreateDependencies_(repositories, factory) {
  var deps = factory();
  if (!repositories) return deps;
  var keys = Object.keys(repositories);
  for (var i = 0; i < keys.length; i += 1) deps[keys[i]] = repositories[keys[i]];
  return deps;
}

if (typeof module !== 'undefined') module.exports = { onboardingCreateDependencies_: onboardingCreateDependencies_ };
