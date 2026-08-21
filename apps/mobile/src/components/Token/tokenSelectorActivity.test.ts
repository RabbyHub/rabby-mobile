import {
  getTokenSelectorActivityState,
  isTokenSelectorSheetOpeningCommand,
} from './tokenSelectorActivity';

describe('isTokenSelectorSheetOpeningCommand', () => {
  it.each([true, 'collapse', 0, 1] as const)(
    'marks %p as an opening command',
    command => {
      expect(isTokenSelectorSheetOpeningCommand(command)).toBe(true);
    },
  );

  it.each([false, 'destroy', -1] as const)(
    'does not treat %p as native close confirmation',
    command => {
      expect(isTokenSelectorSheetOpeningCommand(command)).toBe(false);
    },
  );
});

describe('getTokenSelectorActivityState', () => {
  it('keeps Store publication active during the controlled close delay without consuming Android back', () => {
    expect(
      getTokenSelectorActivityState({
        controlledVisible: true,
        sheetVisible: false,
      }),
    ).toEqual({
      activityActive: true,
      shouldHandleAndroidBack: false,
    });
  });

  it('pauses Store publication only after both visibility sources have closed', () => {
    expect(
      getTokenSelectorActivityState({
        controlledVisible: false,
        sheetVisible: false,
      }),
    ).toEqual({
      activityActive: false,
      shouldHandleAndroidBack: false,
    });
  });

  it('stays active while the native sheet is open', () => {
    expect(
      getTokenSelectorActivityState({
        controlledVisible: false,
        sheetVisible: true,
      }),
    ).toEqual({
      activityActive: true,
      shouldHandleAndroidBack: true,
    });
  });
});
