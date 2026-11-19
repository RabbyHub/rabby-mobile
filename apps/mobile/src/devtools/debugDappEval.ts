/**
 * Non-production automation: run JavaScript in the active dapp webview.
 *
 * Kept in its own module with an explicit `__DEV__` guard so Metro can drop the
 * branch (and the dynamic registry import) from release bundles. Callers still
 * have to pass the non-production maintenance gate (armed Screen E2E session +
 * unlocked wallet).
 */
export async function runDebugDappEval(code?: string) {
  if (!__DEV__ || !code) {
    return;
  }

  const { emitBrowserEval } = await import(
    '@/devtools/screenRegistry/browserEval'
  );
  emitBrowserEval(code);
}
