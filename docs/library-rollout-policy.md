# Shared Library Rollout Policy

This policy controls how shared Apps Script library changes are released to production workbooks.

## 1) Publish a version with changelog before any workbook upgrade

1. Finalize library changes in source control.
2. Publish a new immutable Apps Script library version.
3. Record a changelog entry for that version with:
   - Version number.
   - Date/time published.
   - Behavior changes and risk notes.
   - Required migration steps (if any).
4. Share the changelog link in the release ticket before requesting approvals.

## 2) Pin Onboarding and Audit to the same stable library version

- Keep both production workbooks pinned to the exact same library version number.
- Do not leave either workbook on "HEAD"/"latest".
- Update both version references in the same change request after validation is complete.

## 3) Rollout order: Onboarding first, then Audit

1. Upgrade **Onboarding** workbook/library reference first.
2. Run validation checks for Onboarding flows (intake, status transitions, notifications, and audit append behavior).
3. If validation passes, upgrade **Audit** workbook/library reference to the same version.
4. Re-run post-upgrade smoke checks for both workbooks.

If Onboarding validation fails, do not proceed to Audit.

## 4) Rollback playbook requirements

Maintain a rollback section in the incident/release record that includes:

- Previous known-good library version number.
- Current candidate version number.
- Exact steps to restore previous version references in both workbooks.
- Owner responsible for executing rollback.

## 5) Approval and ownership

### Who approves version bumps

A library version bump to production requires:

1. **Engineering owner** approval (change correctness and compatibility).
2. **HR operations owner** approval (workflow impact and operational readiness).

### Where to update version references

Update version references in these places during each rollout:

1. Apps Script library dependency settings in the **Onboarding** project.
2. Apps Script library dependency settings in the **Audit** project.
3. Release ticket/change log entry documenting:
   - New version.
   - Previous known-good version.
   - Approvers.
   - Validation evidence.
