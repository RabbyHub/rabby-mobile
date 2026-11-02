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

// Unit coverage using the real typed EventEmitter. The native modal host is
// represented by REMOVE/CLOSED events, not by a fabricated resolved promise.
describe('apisAppWin2024 modal-specific close completion', () => {
  afterEach(() => {
    jest.resetModules();
  });

  it('keeps waiting when another modal closes before the requested modal', async () => {
    const { apisAppWin2024, EVENT_NAMES, globalSheetModalEvents } =
      loadAppWin2024Module();
    const settled = jest.fn();
    const completion = apisAppWin2024
      .removeGlobalBottomSheetModal('IMPORT_MORE_ADDRESS_target', {
        waitForDismiss: true,
      })
      .then(id => {
        settled(id);
        return id;
      });

    globalSheetModalEvents.emit(EVENT_NAMES.CLOSED, 'AUTHENTICATION_other');
    await Promise.resolve();
    expect(settled).not.toHaveBeenCalled();
    expect(globalSheetModalEvents.listenerCount(EVENT_NAMES.CLOSED)).toBe(1);

    globalSheetModalEvents.emit(
      EVENT_NAMES.CLOSED,
      'IMPORT_MORE_ADDRESS_target',
    );
    await expect(completion).resolves.toBe('IMPORT_MORE_ADDRESS_target');
    expect(settled).toHaveBeenCalledTimes(1);
    expect(globalSheetModalEvents.listenerCount(EVENT_NAMES.CLOSED)).toBe(0);
  });

  it('observes synchronous close completion without changing removal options', async () => {
    const { apisAppWin2024, EVENT_NAMES, globalSheetModalEvents } =
      loadAppWin2024Module();
    const onRemove = jest.fn(id => {
      globalSheetModalEvents.emit(EVENT_NAMES.CLOSED, id);
    });
    globalSheetModalEvents.on(EVENT_NAMES.REMOVE, onRemove);

    await expect(
      apisAppWin2024.removeGlobalBottomSheetModal('DESCRIPTION_sync', {
        duration: 0,
        waitForDismiss: true,
      }),
    ).resolves.toBe('DESCRIPTION_sync');
    expect(onRemove).toHaveBeenCalledWith('DESCRIPTION_sync', {
      duration: 0,
      waitForDismiss: true,
    });
    expect(globalSheetModalEvents.listenerCount(EVENT_NAMES.CLOSED)).toBe(0);
  });

  it('settles concurrent modal removals independently and only once', async () => {
    const { apisAppWin2024, EVENT_NAMES, globalSheetModalEvents } =
      loadAppWin2024Module();
    const settledA = jest.fn();
    const settledB = jest.fn();
    const completionA = apisAppWin2024
      .removeGlobalBottomSheetModal('DESCRIPTION_a')
      .then(id => {
        settledA(id);
        return id;
      });
    const completionB = apisAppWin2024
      .removeGlobalBottomSheetModal('DESCRIPTION_b')
      .then(id => {
        settledB(id);
        return id;
      });

    globalSheetModalEvents.emit(EVENT_NAMES.CLOSED, 'DESCRIPTION_a');
    await expect(completionA).resolves.toBe('DESCRIPTION_a');
    expect(settledA).toHaveBeenCalledTimes(1);
    expect(settledB).not.toHaveBeenCalled();
    expect(globalSheetModalEvents.listenerCount(EVENT_NAMES.CLOSED)).toBe(1);

    globalSheetModalEvents.emit(EVENT_NAMES.CLOSED, 'DESCRIPTION_a');
    await Promise.resolve();
    expect(settledB).not.toHaveBeenCalled();
    expect(globalSheetModalEvents.listenerCount(EVENT_NAMES.CLOSED)).toBe(1);

    globalSheetModalEvents.emit(EVENT_NAMES.CLOSED, 'DESCRIPTION_b');
    await expect(completionB).resolves.toBe('DESCRIPTION_b');
    globalSheetModalEvents.emit(EVENT_NAMES.CLOSED, 'DESCRIPTION_b');
    await Promise.resolve();
    expect(settledA).toHaveBeenCalledTimes(1);
    expect(settledB).toHaveBeenCalledTimes(1);
    expect(globalSheetModalEvents.listenerCount(EVENT_NAMES.CLOSED)).toBe(0);
  });

  it('resolves multiple callers waiting for the same modal close', async () => {
    const { apisAppWin2024, EVENT_NAMES, globalSheetModalEvents } =
      loadAppWin2024Module();
    const first =
      apisAppWin2024.removeGlobalBottomSheetModal('DESCRIPTION_shared');
    const second =
      apisAppWin2024.removeGlobalBottomSheetModal('DESCRIPTION_shared');

    globalSheetModalEvents.emit(EVENT_NAMES.CLOSED, 'DESCRIPTION_shared');
    await expect(Promise.all([first, second])).resolves.toEqual([
      'DESCRIPTION_shared',
      'DESCRIPTION_shared',
    ]);
    expect(globalSheetModalEvents.listenerCount(EVENT_NAMES.CLOSED)).toBe(0);
  });

  it.each([undefined, null])('does not listen or emit for id %s', async id => {
    const { apisAppWin2024, EVENT_NAMES, globalSheetModalEvents } =
      loadAppWin2024Module();
    const onRemove = jest.fn();
    globalSheetModalEvents.on(EVENT_NAMES.REMOVE, onRemove);

    await expect(apisAppWin2024.removeGlobalBottomSheetModal(id)).resolves.toBe(
      undefined,
    );
    expect(onRemove).not.toHaveBeenCalled();
    expect(globalSheetModalEvents.listenerCount(EVENT_NAMES.CLOSED)).toBe(0);
  });

  it('still asks the host to finalize a modal whose prior close already completed', async () => {
    const { apisAppWin2024, EVENT_NAMES, globalSheetModalEvents } =
      loadAppWin2024Module();
    globalSheetModalEvents.emit(EVENT_NAMES.CLOSED, 'DESCRIPTION_closed');
    // The host finalizes an absent modal synchronously when REMOVE arrives.
    const onRemove = jest.fn(id => {
      globalSheetModalEvents.emit(EVENT_NAMES.CLOSED, id);
    });
    globalSheetModalEvents.on(EVENT_NAMES.REMOVE, onRemove);

    await expect(
      apisAppWin2024.removeGlobalBottomSheetModal('DESCRIPTION_closed'),
    ).resolves.toBe('DESCRIPTION_closed');
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(globalSheetModalEvents.listenerCount(EVENT_NAMES.CLOSED)).toBe(0);
  });
});
