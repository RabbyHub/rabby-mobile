export type TokenSelectorActivityState = {
  controlledVisible: boolean;
  sheetVisible: boolean;
};

export function getTokenSelectorActivityState({
  controlledVisible,
  sheetVisible,
}: TokenSelectorActivityState) {
  return {
    // Keep Store publication active until both visibility sources have closed.
    activityActive: controlledVisible || sheetVisible,
    // Android back handling follows the actual sheet, not delayed React state.
    shouldHandleAndroidBack: sheetVisible,
  };
}
