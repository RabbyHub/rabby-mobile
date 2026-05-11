---
name: mobile-debug-pages
description: When adding or refactoring a debug, probe, or migration-diagnostics screen in `apps/mobile`, keep the page focused on live state and results, move explanatory text and manual test instructions into a help bottom sheet, and centralize operations in an actions sheet instead of filling the page with inline controls.
---

# Mobile Debug Pages

Use this playbook for `apps/mobile` screens that expose:

- internal state snapshots
- probe or migration actions
- manual test cases
- debug exports
- raw payload inspection

## Core Rule

Prefer a state-first page.

The main scroll area should primarily show:

- current configuration
- status summaries
- detailed raw state
- latest action results
- latest error output

Do not fill the page with long explanatory cards if that content is not needed every time.

## Rules

1. Move explanations behind a help entry.

   If a section needs background, test steps, or expected behavior, put it in a help bottom sheet triggered from a small question or info icon near that section title.

2. Keep actions in a bottom sheet when the page has multiple operations.

   Use a footer action button plus `AppBottomSheetModal` for:

   - probe writes
   - decrypt/read actions
   - reset or clear actions
   - share/export actions

   Do not leave a long stack of inline buttons between data cards unless the action is the page's only purpose.

3. Treat explanations and actions as separate concerns.

   - help sheet: why, what to test, what to expect
   - actions sheet: what to run right now

4. Keep summary cards fixed and compact.

   Good candidates:

   - current implementation
   - source package
   - key flags
   - short badge summaries

   Do not make these cards horizontally scroll unless the content truly requires it.

5. Make verbose detail cards scrollable instead of stretching the whole page.

   For raw payloads, base64 blobs, cipher metadata, or multi-field native diagnostics:

   - wrap content in a vertical `ScrollView`
   - allow horizontal scroll for wide values
   - cap height around half the screen

6. Prefer dense grids for repeated short fields.

   If a detail card contains many short status values, group them into compact rows instead of one long vertical list.

7. Keep secret reveal debug-only and local.

   If a debug page can reveal a password or decrypted payload:

   - gate the reveal UI with `__DEV__`
   - use a small eye toggle near the result title
   - default to masked output

8. Make export/share explicit.

   If the page exports debug artifacts, keep `Share Debug Info` on its own line when it is important. If file export is involved, also read [`apps/mobile/skills/file-share.md`](./file-share.md).

9. When comparing implementations, separate them clearly.

   If the page compares versions, wrappers, or raw-vs-business behavior:

   - keep a clear “current” summary
   - separate each implementation into its own section or tab
   - include the effective/current selection in the exported JSON

## Preferred Layout

Typical structure:

1. Current selection or top-level summary
2. Section tabs if multiple implementations are being compared
3. Status summary card
4. Detail/result/error cards
5. Footer action button opening an actions sheet
6. Help icon per section opening a help sheet

## Help Sheet Content

Good content for the help sheet:

- what this section represents
- prompt policy differences
- manual reproduction steps
- expected behavior
- regression signals

Bad content for the main page:

- long “how to use this page” blocks
- test-case prose that never changes
- repeated explanations copied next to each button

## Current References

- [`src/screens/Testkits/DevDataKeychain.tsx`](../src/screens/Testkits/DevDataKeychain.tsx)
- [`src/screens/Testkits/DebugLogViewer.tsx`](../src/screens/Testkits/DebugLogViewer.tsx)
- [`src/utils/shareLocalFile.ts`](../src/utils/shareLocalFile.ts)
