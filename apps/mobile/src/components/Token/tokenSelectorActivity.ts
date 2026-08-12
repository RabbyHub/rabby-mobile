export type TokenSelectorActivityState = {
  controlledVisible: boolean;
  sheetVisible: boolean;
};

export function getTokenSelectorActivityState({
  controlledVisible,
  sheetVisible,
}: TokenSelectorActivityState) {
  return {
    // Keep lifecycle props flowing until both visibility sources have closed.
    renderActive: controlledVisible || sheetVisible,
    // Android back handling follows the actual sheet, not delayed React state.
    shouldHandleAndroidBack: sheetVisible,
  };
}
