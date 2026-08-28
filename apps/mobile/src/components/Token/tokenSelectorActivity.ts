export type TokenSelectorActivityState = {
  controlledVisible: boolean;
  sheetVisible: boolean;
};

export type TokenSelectorSheetCommand =
  | boolean
  | 'destroy'
  | 'collapse'
  | number;

export function isTokenSelectorSheetOpeningCommand(
  command: TokenSelectorSheetCommand,
) {
  return (
    command === true ||
    command === 'collapse' ||
    (typeof command === 'number' && command >= 0)
  );
}

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
