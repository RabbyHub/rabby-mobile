function loadAppWin2024Module() {
  jest.resetModules();

  const appWinModule = require('./appWin') as typeof import('./appWin');
  const eventModule =
    require('@/components2024/GlobalBottomSheetModal/event') as typeof import('@/components2024/GlobalBottomSheetModal/event');
  const typesModule =
    require('@/components2024/GlobalBottomSheetModal/types') as typeof import('@/components2024/GlobalBottomSheetModal/types');

  return {
    ...appWinModule,
    ...eventModule,
    ...typesModule,
  };
}

describe('apisAppWin2024 global bottom sheet singleton', () => {
  afterEach(() => {
    jest.resetModules();
  });

  it('reuses the active modal id by modal name by default', () => {
    const { apisAppWin2024, EVENT_NAMES, MODAL_NAMES, globalSheetModalEvents } =
      loadAppWin2024Module();
    const createdIds: string[] = [];
    const presentedIds: string[] = [];

    globalSheetModalEvents.on(EVENT_NAMES.CREATE, id => {
      createdIds.push(id);
    });
    globalSheetModalEvents.on(EVENT_NAMES.PRESENT, id => {
      presentedIds.push(id);
    });

    const firstId = apisAppWin2024.createGlobalBottomSheetModal({
      name: MODAL_NAMES.DESCRIPTION,
      title: 'Risk',
      sections: [{ description: 'Risk details' }],
    });
    const secondId = apisAppWin2024.createGlobalBottomSheetModal({
      name: MODAL_NAMES.DESCRIPTION,
      title: 'Risk',
      sections: [{ description: 'Risk details' }],
    });

    expect(secondId).toBe(firstId);
    expect(createdIds).toEqual([firstId]);
    expect(presentedIds).toEqual([firstId]);
  });

  it('creates a new singleton instance after the previous one is dismissed', () => {
    const { apisAppWin2024, EVENT_NAMES, MODAL_NAMES, globalSheetModalEvents } =
      loadAppWin2024Module();

    const firstId = apisAppWin2024.createGlobalBottomSheetModal({
      name: MODAL_NAMES.DESCRIPTION,
      title: 'Risk',
      sections: [{ description: 'Risk details' }],
    });
    globalSheetModalEvents.emit(EVENT_NAMES.DISMISS, firstId);
    const secondId = apisAppWin2024.createGlobalBottomSheetModal({
      name: MODAL_NAMES.DESCRIPTION,
      title: 'Risk',
      sections: [{ description: 'Risk details' }],
    });

    expect(secondId).not.toBe(firstId);
  });

  it('allows explicit multiple instances for the same modal name', () => {
    const { apisAppWin2024, EVENT_NAMES, MODAL_NAMES, globalSheetModalEvents } =
      loadAppWin2024Module();
    const createdIds: string[] = [];

    globalSheetModalEvents.on(EVENT_NAMES.CREATE, id => {
      createdIds.push(id);
    });

    const firstId = apisAppWin2024.createGlobalBottomSheetModal({
      name: MODAL_NAMES.DESCRIPTION,
      title: 'Risk',
      sections: [{ description: 'Risk details' }],
      allowMultipleInstances: true,
    });
    const secondId = apisAppWin2024.createGlobalBottomSheetModal({
      name: MODAL_NAMES.DESCRIPTION,
      title: 'Risk',
      sections: [{ description: 'Risk details' }],
      allowMultipleInstances: true,
    });

    expect(secondId).not.toBe(firstId);
    expect(createdIds).toEqual([firstId, secondId]);
  });

  it('uses singletonKey as an optional discriminator', () => {
    const { apisAppWin2024, MODAL_NAMES } = loadAppWin2024Module();

    const firstAId = apisAppWin2024.createGlobalBottomSheetModal({
      name: MODAL_NAMES.DESCRIPTION,
      title: 'Risk A',
      sections: [{ description: 'Risk details' }],
      singletonKey: 'a',
    });
    const secondAId = apisAppWin2024.createGlobalBottomSheetModal({
      name: MODAL_NAMES.DESCRIPTION,
      title: 'Risk A',
      sections: [{ description: 'Risk details' }],
      singletonKey: 'a',
    });
    const bId = apisAppWin2024.createGlobalBottomSheetModal({
      name: MODAL_NAMES.DESCRIPTION,
      title: 'Risk B',
      sections: [{ description: 'Risk details' }],
      singletonKey: 'b',
    });

    expect(secondAId).toBe(firstAId);
    expect(bId).not.toBe(firstAId);
  });

  it('separates approval modals by approvalComponent', () => {
    const {
      apisAppWin2024,
      APPROVAL_MODAL_NAMES,
      EVENT_NAMES,
      MODAL_NAMES,
      globalSheetModalEvents,
    } = loadAppWin2024Module();
    const createdIds: string[] = [];
    const presentedIds: string[] = [];

    globalSheetModalEvents.on(EVENT_NAMES.CREATE, id => {
      createdIds.push(id);
    });
    globalSheetModalEvents.on(EVENT_NAMES.PRESENT, id => {
      presentedIds.push(id);
    });

    const signTxId = apisAppWin2024.createGlobalBottomSheetModal({
      name: MODAL_NAMES.APPROVAL,
      approvalComponent: APPROVAL_MODAL_NAMES.SignTx,
    });
    const sameSignTxId = apisAppWin2024.createGlobalBottomSheetModal({
      name: MODAL_NAMES.APPROVAL,
      approvalComponent: APPROVAL_MODAL_NAMES.SignTx,
    });
    const waitingId = apisAppWin2024.createGlobalBottomSheetModal({
      name: MODAL_NAMES.APPROVAL,
      approvalComponent: APPROVAL_MODAL_NAMES.PrivatekeyWaiting,
    });

    expect(sameSignTxId).toBe(signTxId);
    expect(waitingId).not.toBe(signTxId);
    expect(createdIds).toEqual([signTxId, waitingId]);
    expect(presentedIds).toEqual([signTxId]);
  });
});
