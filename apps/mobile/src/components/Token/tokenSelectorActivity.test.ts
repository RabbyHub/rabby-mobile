import { getTokenSelectorActivityState } from './tokenSelectorActivity';

describe('getTokenSelectorActivityState', () => {
  it('keeps rendering during the controlled close delay without consuming Android back', () => {
    expect(
      getTokenSelectorActivityState({
        controlledVisible: true,
        sheetVisible: false,
      }),
    ).toEqual({
      renderActive: true,
      shouldHandleAndroidBack: false,
    });
  });

  it('freezes only after both visibility sources have closed', () => {
    expect(
      getTokenSelectorActivityState({
        controlledVisible: false,
        sheetVisible: false,
      }),
    ).toEqual({
      renderActive: false,
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
      renderActive: true,
      shouldHandleAndroidBack: true,
    });
  });
});
