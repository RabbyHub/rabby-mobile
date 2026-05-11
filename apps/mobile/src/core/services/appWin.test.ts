function loadLegacyAppWinModule() {
  jest.resetModules();

  const appWinModule = require('./appWin') as typeof import('./appWin');
  const eventModule =
    require('@/components/GlobalBottomSheetModal/event') as typeof import('@/components/GlobalBottomSheetModal/event');
  const typesModule =
    require('@/components/GlobalBottomSheetModal/types') as typeof import('@/components/GlobalBottomSheetModal/types');

  return {
    ...appWinModule,
    ...eventModule,
    ...typesModule,
  };
}

describe('legacy apisAppWin global bottom sheet singleton', () => {
  afterEach(() => {
    jest.resetModules();
  });

  it('reuses the active modal id by modal name by default', () => {
    const { apisAppWin, EVENT_NAMES, MODAL_NAMES, globalSheetModalEvents } =
      loadLegacyAppWinModule();
    const createdIds: string[] = [];
    const presentedIds: string[] = [];

    globalSheetModalEvents.on(EVENT_NAMES.CREATE, id => {
      createdIds.push(id);
    });
    globalSheetModalEvents.on(EVENT_NAMES.PRESENT, id => {
      presentedIds.push(id);
    });

    const firstId = apisAppWin.createGlobalBottomSheetModal({
      name: MODAL_NAMES.TIP_PRIVACY_POLICY,
    });
    const secondId = apisAppWin.createGlobalBottomSheetModal({
      name: MODAL_NAMES.TIP_PRIVACY_POLICY,
    });

    expect(secondId).toBe(firstId);
    expect(createdIds).toEqual([firstId]);
    expect(presentedIds).toEqual([firstId]);
  });

  it('creates a new singleton instance after the previous one is dismissed', () => {
    const { apisAppWin, EVENT_NAMES, MODAL_NAMES, globalSheetModalEvents } =
      loadLegacyAppWinModule();

    const firstId = apisAppWin.createGlobalBottomSheetModal({
      name: MODAL_NAMES.TIP_TERM_OF_USE,
    });
    globalSheetModalEvents.emit(EVENT_NAMES.DISMISS, firstId);
    const secondId = apisAppWin.createGlobalBottomSheetModal({
      name: MODAL_NAMES.TIP_TERM_OF_USE,
    });

    expect(secondId).not.toBe(firstId);
  });

  it('allows explicit multiple instances for the same modal name', () => {
    const { apisAppWin, EVENT_NAMES, MODAL_NAMES, globalSheetModalEvents } =
      loadLegacyAppWinModule();
    const createdIds: string[] = [];

    globalSheetModalEvents.on(EVENT_NAMES.CREATE, id => {
      createdIds.push(id);
    });

    const firstId = apisAppWin.createGlobalBottomSheetModal({
      name: MODAL_NAMES.TIP_PRIVACY_POLICY,
      allowMultipleInstances: true,
    });
    const secondId = apisAppWin.createGlobalBottomSheetModal({
      name: MODAL_NAMES.TIP_PRIVACY_POLICY,
      allowMultipleInstances: true,
    });

    expect(secondId).not.toBe(firstId);
    expect(createdIds).toEqual([firstId, secondId]);
  });
});
