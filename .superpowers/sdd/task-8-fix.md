# Task 8 Fix Report

Status: done

## Root cause

`step` persisted the previously displayed catalog index. When a retry returned fewer category groups, rendering indexed `steps[step]` before the state could be corrected, so `current.category` threw for an out-of-range index.

## Fix

- Derive a bounded `currentStep` for every render, ensuring the current category is always present.
- Normalize persisted `step` in an effect when a non-empty catalog changes; no state is updated during render.
- Keep next/back navigation bounded by the active catalog limits.
- Add `role="status"` and `aria-busy="true"` to loading, and `role="alert"` with `aria-live="assertive"` to save errors.

## TDD and verification

- RED: `npm test -- src/features/onboarding/ManualWizard.test.tsx` failed with `TypeError: Cannot read properties of undefined (reading 'category')` after retrying a later step with a reduced catalog. It also failed the new loading and save-error accessibility assertions.
- GREEN: `npm test -- src/features/onboarding/ManualWizard.test.tsx` passed: 1 file, 12 tests.
- Full suite: `npm test` passed: 68 files, 208 tests.
- Build: `npm run build` passed. Vite retained its pre-existing warning for a JavaScript chunk above 500 kB.
