function createKeyring() {
  return {
    init: jest.fn(),
    bridge: {
      receivePin: jest.fn(),
      receivePassphrase: jest.fn(),
      cancel: jest.fn(),
    },
  } as any;
}

function setupOneKeyEventsModule() {
  jest.resetModules();

  const mockCreateGlobalBottomSheetModal = jest.fn(() => 'modal-id');
  let dismissListener: ((id: string) => void) | undefined;
  const mockRemoveGlobalBottomSheetModal = jest.fn(id => {
    if (typeof id !== 'string') {
      return;
    }
    dismissListener?.(id);
  });
  const mockGlobalBottomSheetModalAddListener = jest.fn((eventName, cb) => {
    if (eventName === 'DISMISS') {
      dismissListener = cb;
    }
  });
  const { EventEmitter } = require('events');
  const eventBus = new EventEmitter();
  const EVENTS = {
    ONEKEY: {
      REQUEST_PIN: 'ONEKEY_REQUEST_PIN',
      REQUEST_PASSPHRASE: 'ONEKEY_REQUEST_PASSPHRASE',
      CLOSE_UI_WINDOW: 'ONEKEY_CLOSE_UI_WINDOW',
    },
  };

  jest.doMock('@/components2024/GlobalBottomSheetModal/types', () => ({
    EVENT_NAMES: {
      DISMISS: 'DISMISS',
    },
    MODAL_NAMES: {
      ONEKEY_INPUT_PIN: 'ONEKEY_INPUT_PIN',
      ONEKEY_INPUT_PASSPHRASE: 'ONEKEY_INPUT_PASSPHRASE',
      ONEKEY_TEMP_PIN_OR_PASSPHRASE: 'ONEKEY_TEMP_PIN_OR_PASSPHRASE',
    },
  }));

  jest.doMock('@/core/services2024/appWin', () => ({
    apisAppWin2024: {
      createGlobalBottomSheetModal: mockCreateGlobalBottomSheetModal,
      removeGlobalBottomSheetModal: mockRemoveGlobalBottomSheetModal,
      globalBottomSheetModalAddListener: mockGlobalBottomSheetModalAddListener,
    },
  }));
  jest.doMock('./events', () => ({
    EVENT_ONEKEY_CLOSE_UI_PIN_WINDOW: 'ONEKEY_CLOSE_UI_PIN_WINDOW',
    EVENT_ONEKEY_REQUEST_BUTTON: 'ONEKEY_REQUEST_BUTTON',
    EVENT_ONEKEY_REQUEST_PASSPHRASE_ON_DEVICE:
      'ONEKEY_REQUEST_PASSPHRASE_ON_DEVICE',
    eventBus,
    EVENTS,
  }));

  const oneKeyModule = require('./onekey') as typeof import('./onekey');
  const eventsModule = require('./events') as typeof import('./events');

  return {
    ...oneKeyModule,
    ...eventsModule,
    mockCreateGlobalBottomSheetModal,
    mockRemoveGlobalBottomSheetModal,
    mockGlobalBottomSheetModalAddListener,
  };
}

describe('bindOneKeyEvents', () => {
  afterEach(() => {
    jest.dontMock('@/components2024/GlobalBottomSheetModal/types');
    jest.dontMock('@/core/services2024/appWin');
    jest.dontMock('./events');
  });

  it('switches REQUEST_PASSPHRASE to device-side input and shows the waiting modal', () => {
    const {
      bindOneKeyEvents,
      eventBus,
      EVENTS,
      mockCreateGlobalBottomSheetModal,
    } = setupOneKeyEventsModule();
    const keyring = createKeyring();

    bindOneKeyEvents(keyring);
    eventBus.emit(EVENTS.ONEKEY.REQUEST_PASSPHRASE, {
      payload: {
        device: {
          connectId: 'connect-id',
        },
      },
    });

    expect(keyring.bridge.receivePassphrase).toHaveBeenCalledWith({
      passphrase: '',
      switchOnDevice: true,
    });
    expect(mockCreateGlobalBottomSheetModal).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'ONEKEY_TEMP_PIN_OR_PASSPHRASE',
        onConfirm: expect.any(Function),
      }),
    );
  });

  it('does not send a passphrase response when SDK reports device-side input', () => {
    const {
      bindOneKeyEvents,
      eventBus,
      EVENT_ONEKEY_REQUEST_PASSPHRASE_ON_DEVICE,
      mockCreateGlobalBottomSheetModal,
    } = setupOneKeyEventsModule();
    const keyring = createKeyring();

    bindOneKeyEvents(keyring);
    eventBus.emit(EVENT_ONEKEY_REQUEST_PASSPHRASE_ON_DEVICE, {
      payload: {
        device: {
          connectId: 'connect-id',
        },
      },
    });

    expect(keyring.bridge.receivePassphrase).not.toHaveBeenCalled();
    expect(mockCreateGlobalBottomSheetModal).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'ONEKEY_TEMP_PIN_OR_PASSPHRASE',
      }),
    );
  });

  it('still acknowledges repeated passphrase requests when the waiting modal already exists', () => {
    const {
      bindOneKeyEvents,
      eventBus,
      EVENTS,
      mockCreateGlobalBottomSheetModal,
    } = setupOneKeyEventsModule();
    const keyring = createKeyring();
    const passphraseRequest = {
      payload: {
        device: {
          connectId: 'connect-id',
        },
      },
    };

    bindOneKeyEvents(keyring);
    eventBus.emit(EVENTS.ONEKEY.REQUEST_PASSPHRASE, passphraseRequest);
    eventBus.emit(EVENTS.ONEKEY.REQUEST_PASSPHRASE, passphraseRequest);

    expect(keyring.bridge.receivePassphrase).toHaveBeenCalledTimes(2);
    expect(keyring.bridge.receivePassphrase).toHaveBeenCalledWith({
      passphrase: '',
      switchOnDevice: true,
    });
    expect(mockCreateGlobalBottomSheetModal).toHaveBeenCalledTimes(1);
  });

  it('closes the waiting modal when the SDK closes the pin window', () => {
    const {
      bindOneKeyEvents,
      eventBus,
      EVENTS,
      EVENT_ONEKEY_CLOSE_UI_PIN_WINDOW,
      mockRemoveGlobalBottomSheetModal,
    } = setupOneKeyEventsModule();
    const keyring = createKeyring();

    bindOneKeyEvents(keyring);
    eventBus.emit(EVENTS.ONEKEY.REQUEST_PASSPHRASE, {
      payload: {
        device: {
          connectId: 'connect-id',
        },
      },
    });
    eventBus.emit(EVENT_ONEKEY_CLOSE_UI_PIN_WINDOW);

    expect(mockRemoveGlobalBottomSheetModal).toHaveBeenCalledWith('modal-id', {
      waitMaxtime: 300,
    });
    expect(keyring.bridge.cancel).not.toHaveBeenCalled();
  });

  it('does not cancel when pin and passphrase waiting modals share one singleton id', () => {
    const {
      bindOneKeyEvents,
      eventBus,
      EVENTS,
      EVENT_ONEKEY_CLOSE_UI_PIN_WINDOW,
      mockRemoveGlobalBottomSheetModal,
    } = setupOneKeyEventsModule();
    const keyring = createKeyring();

    bindOneKeyEvents(keyring);
    eventBus.emit(EVENTS.ONEKEY.REQUEST_PIN, {
      payload: {
        device: {
          connectId: 'connect-id',
        },
      },
    });
    eventBus.emit(EVENTS.ONEKEY.REQUEST_PASSPHRASE, {
      payload: {
        device: {
          connectId: 'connect-id',
        },
      },
    });
    eventBus.emit(EVENT_ONEKEY_CLOSE_UI_PIN_WINDOW);

    expect(mockRemoveGlobalBottomSheetModal).toHaveBeenCalledWith('modal-id', {
      waitMaxtime: 300,
    });
    expect(keyring.bridge.cancel).not.toHaveBeenCalled();
  });

  it('closes the waiting modal when the SDK asks for device confirmation', () => {
    const {
      bindOneKeyEvents,
      eventBus,
      EVENTS,
      EVENT_ONEKEY_REQUEST_BUTTON,
      mockRemoveGlobalBottomSheetModal,
    } = setupOneKeyEventsModule();
    const keyring = createKeyring();

    bindOneKeyEvents(keyring);
    eventBus.emit(EVENTS.ONEKEY.REQUEST_PIN, {
      payload: {
        device: {
          connectId: 'connect-id',
        },
      },
    });
    eventBus.emit(EVENT_ONEKEY_REQUEST_BUTTON);

    expect(mockRemoveGlobalBottomSheetModal).toHaveBeenCalledWith('modal-id', {
      waitMaxtime: 300,
    });
    expect(keyring.bridge.cancel).not.toHaveBeenCalled();
  });

  it('does not miss device confirmation emitted while acknowledging device-side PIN', () => {
    const {
      bindOneKeyEvents,
      eventBus,
      EVENTS,
      EVENT_ONEKEY_REQUEST_BUTTON,
      mockRemoveGlobalBottomSheetModal,
    } = setupOneKeyEventsModule();
    const keyring = createKeyring();
    keyring.bridge.receivePin.mockImplementation(() => {
      eventBus.emit(EVENT_ONEKEY_REQUEST_BUTTON);
    });

    bindOneKeyEvents(keyring);
    eventBus.emit(EVENTS.ONEKEY.REQUEST_PIN, {
      payload: {
        device: {
          connectId: 'connect-id',
        },
      },
    });

    expect(mockRemoveGlobalBottomSheetModal).toHaveBeenCalledWith('modal-id', {
      waitMaxtime: 300,
    });
    expect(keyring.bridge.cancel).not.toHaveBeenCalled();
  });

  it('cancels the request when the user dismisses the device-side waiting modal', () => {
    const {
      bindOneKeyEvents,
      eventBus,
      EVENTS,
      mockGlobalBottomSheetModalAddListener,
    } = setupOneKeyEventsModule();
    const keyring = createKeyring();

    bindOneKeyEvents(keyring);
    eventBus.emit(EVENTS.ONEKEY.REQUEST_PASSPHRASE, {
      payload: {
        device: {
          connectId: 'connect-id',
        },
      },
    });
    mockGlobalBottomSheetModalAddListener.mock.calls[0][1]('modal-id');

    expect(keyring.bridge.cancel).toHaveBeenCalledWith('connect-id');
  });

  it('binds each OneKey keyring instance once', () => {
    const { bindOneKeyEvents } = setupOneKeyEventsModule();
    const keyring = createKeyring();

    bindOneKeyEvents(keyring);
    bindOneKeyEvents(keyring);

    expect(keyring.init).toHaveBeenCalledTimes(1);
  });
});
