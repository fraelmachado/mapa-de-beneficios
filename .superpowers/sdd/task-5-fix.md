# Task 5 review fix

## Scope

- Added an authenticated-account logout action in `Perfil`, using `supabase.auth.signOut()`.
- Added pending and error state for logout; the existing `AuthProvider` remains responsible for handling `SIGNED_OUT` and restoring the anonymous session.
- Marked asynchronous email-link and logout errors with `role="alert"`.
- Exposed the selected theme with `aria-pressed` and announced changes through a polite live region.

## TDD evidence

### Red

Command:

```sh
npm test -- Perfil
```

Output summary: `src/features/perfil/Perfil.test.tsx` ran 8 tests; 4 failed as expected because the page had no alert role, logout button/state, or theme `aria-pressed` state.

### Green

Command:

```sh
npm test -- Perfil
```

Output summary: 1 test file passed, with 9 of 9 tests passing.

## Verification

Command:

```sh
npm run build
```

Output summary: `tsc && vite build` completed successfully. Vite emitted its non-failing warning that the generated JavaScript chunk is larger than 500 kB.

Command:

```sh
git diff --check
```

Output summary: exited successfully with no whitespace errors.
