---
name: mobile-file-share
description: When adding debug export or local file sharing flows in `apps/mobile`, write the artifact with `react-native-fs` and reuse `@/utils/shareLocalFile` instead of duplicating iOS `Share.share` and Android `RNHelpers.shareFile` logic in each screen.
---

# Mobile File Share

Use this playbook when a screen needs to export a local artifact such as:

- debug JSON
- applog zip or extracted log file
- sqlite snapshot
- ad hoc native diagnostics

## Rules

1. Reuse [`src/utils/shareLocalFile.ts`](../src/utils/shareLocalFile.ts) for the actual system share step.

2. Let the screen own artifact creation.

   Typical flow:

   - collect the payload
   - write it to a temp or cache directory with `react-native-fs`
   - pass the resulting path into `shareLocalFile`

3. Keep platform branching out of screens unless the feature truly needs platform-specific UX.

   `shareLocalFile` already handles:

   - iOS via `Share.share`
   - Android via `RNHelpers.shareFile`
   - optional cleanup of temp files after sharing

4. Prefer a single explicit share action when the export is primary.

   If the page already has a crowded action row, put the share button on its own line instead of squeezing it into a multi-button row.

5. Be deliberate about sensitive data.

   If the exported file can contain secrets, decrypted payloads, or account data:

   - keep it to debug-only flows when possible
   - label the action clearly
   - avoid background auto-export

## Example

```ts
const shareDir =
  RNFS.TemporaryDirectoryPath ||
  RNFS.CachesDirectoryPath ||
  RNFS.DocumentDirectoryPath;
const filePath = `${shareDir}/example-debug.json`;

await RNFS.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8');

await shareLocalFile({
  path: filePath,
  name: 'example-debug.json',
  mimeType: 'application/json',
  title: 'Share debug info',
  subject: 'example-debug.json',
  message: 'Rabby debug info',
});
```

## Current References

- [`src/screens/Testkits/DevDataKeychain.tsx`](../src/screens/Testkits/DevDataKeychain.tsx)
- [`src/screens/Testkits/DebugLogViewer.tsx`](../src/screens/Testkits/DebugLogViewer.tsx)
