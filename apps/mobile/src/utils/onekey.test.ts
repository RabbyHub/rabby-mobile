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
  const mockRemoveGlobalBottomSheetModal = jest.fn();
  const mockGlobalBottomSheetModalAddListener = jest.fn();
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

  it('binds each OneKey keyring instance once', () => {
    const { bindOneKeyEvents } = setupOneKeyEventsModule();
    const keyring = createKeyring();

    bindOneKeyEvents(keyring);
    bindOneKeyEvents(keyring);

    expect(keyring.init).toHaveBeenCalledTimes(1);
  });
});
