import { getTokenSelectorActivityState } from './tokenSelectorActivity';

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
