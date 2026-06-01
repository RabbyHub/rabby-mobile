import EventEmitter from 'events';

type Harness = {
  bindOneKeyEvents: (keyring: any) => void;
  eventBus: EventEmitter;
  EVENTS: {
    ONEKEY: {
      CLOSE_UI_WINDOW: string;
      REQUEST_PASSPHRASE: string;
      REQUEST_PIN: string;
    };
  };
  modalApi: {
    createGlobalBottomSheetModal: jest.Mock;
    removeGlobalBottomSheetModal: jest.Mock;
    globalBottomSheetModalAddListener: jest.Mock;
  };
  modals: Record<
    string,
    {
      name: string;
      onConfirm: (...args: any[]) => void;
    }
  >;
  dismissListeners: Array<(id: string) => void>;
};

const loadHarness = (): Harness => {
  jest.resetModules();

  const eventBus = new EventEmitter();
  const EVENTS = {
    ONEKEY: {
      CLOSE_UI_WINDOW: 'ONEKEY.CLOSE_UI_WINDOW',
      REQUEST_PASSPHRASE: 'ONEKEY.REQUEST_PASSPHRASE',
      REQUEST_PIN: 'ONEKEY.REQUEST_PIN',
    },
  };
  const modals: Harness['modals'] = {};
  const dismissListeners: Harness['dismissListeners'] = [];
  let nextId = 0;
  const modalApi = {
    createGlobalBottomSheetModal: jest.fn(config => {
      const id = `modal-${++nextId}`;
      modals[id] = config;
      return id;
    }),
    removeGlobalBottomSheetModal: jest.fn(),
    globalBottomSheetModalAddListener: jest.fn((_event, listener) => {
      dismissListeners.push(listener);
    }),
  };

  jest.doMock('@/components2024/GlobalBottomSheetModal/types', () => ({
    EVENT_NAMES: {
      DISMISS: 'DISMISS',
    },
    MODAL_NAMES: {
      ONEKEY_INPUT_PASSPHRASE: 'ONEKEY_INPUT_PASSPHRASE',
      ONEKEY_INPUT_PIN: 'ONEKEY_INPUT_PIN',
      ONEKEY_TEMP_PIN_OR_PASSPHRASE: 'ONEKEY_TEMP_PIN_OR_PASSPHRASE',
    },
  }));
  jest.doMock('@rabby-wallet/service-keyring', () => ({}));
  jest.doMock('./events', () => ({
    eventBus,
    EVENTS,
  }));
  jest.doMock('@/core/services2024/appWin', () => ({
    apisAppWin2024: modalApi,
  }));

  const { bindOneKeyEvents } = require('./onekey') as typeof import('./onekey');
  return {
    bindOneKeyEvents,
    eventBus,
    EVENTS,
    modalApi,
    modals,
    dismissListeners,
  };
};

const createOneKeyKeyring = () => ({
  init: jest.fn(),
  bridge: {
    cancel: jest.fn(),
    receivePassphrase: jest.fn(),
    receivePin: jest.fn(),
  },
});

const requestEvent = (connectId: string) => ({
  payload: {
    device: {
      connectId,
    },
  },
});

describe('bindOneKeyEvents', () => {
  afterEach(() => {
    jest.resetModules();
    jest.dontMock('@/components2024/GlobalBottomSheetModal/types');
    jest.dontMock('@rabby-wallet/service-keyring');
    jest.dontMock('./events');
    jest.dontMock('@/core/services2024/appWin');
  });

  it('initializes the keyring and handles PIN requests on-device first', () => {
    const harness = loadHarness();
    const keyring = createOneKeyKeyring();

    harness.bindOneKeyEvents(keyring);
    harness.eventBus.emit(
      harness.EVENTS.ONEKEY.REQUEST_PIN,
      requestEvent('c1'),
    );

    expect(keyring.init).toHaveBeenCalled();
    expect(keyring.bridge.receivePin).toHaveBeenCalledWith({
      switchOnDevice: true,
    });
    expect(harness.modalApi.createGlobalBottomSheetModal).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'ONEKEY_TEMP_PIN_OR_PASSPHRASE',
      }),
    );

    harness.eventBus.emit(
      harness.EVENTS.ONEKEY.REQUEST_PIN,
      requestEvent('c2'),
    );
    expect(harness.modalApi.createGlobalBottomSheetModal).toHaveBeenCalledTimes(
      1,
    );
  });

  it('forwards PIN confirmation and close events to the bridge and modal API', () => {
    const harness = loadHarness();
    const keyring = createOneKeyKeyring();

    harness.bindOneKeyEvents(keyring);
    harness.eventBus.emit(
      harness.EVENTS.ONEKEY.REQUEST_PIN,
      requestEvent('c1'),
    );

    harness.modals['modal-1'].onConfirm('1234', false);

    expect(keyring.bridge.receivePin).toHaveBeenCalledWith({
      pin: '1234',
      switchOnDevice: false,
    });

    harness.eventBus.emit(harness.EVENTS.ONEKEY.CLOSE_UI_WINDOW);

    expect(harness.modalApi.removeGlobalBottomSheetModal).toHaveBeenCalledWith(
      'modal-1',
      { waitMaxtime: 300 },
    );
  });

  it('cancels the PIN request when its modal is dismissed', () => {
    const harness = loadHarness();
    const keyring = createOneKeyKeyring();

    harness.bindOneKeyEvents(keyring);
    harness.eventBus.emit(
      harness.EVENTS.ONEKEY.REQUEST_PIN,
      requestEvent('c1'),
    );

    harness.dismissListeners[0]('not-the-pin-modal');
    expect(keyring.bridge.cancel).not.toHaveBeenCalled();

    harness.dismissListeners[0]('modal-1');
    expect(keyring.bridge.cancel).toHaveBeenCalledWith('c1');
  });

  it('handles passphrase requests on-device first and forwards confirmation', () => {
    const harness = loadHarness();
    const keyring = createOneKeyKeyring();

    harness.bindOneKeyEvents(keyring);
    harness.eventBus.emit(
      harness.EVENTS.ONEKEY.REQUEST_PASSPHRASE,
      requestEvent('c2'),
    );

    expect(keyring.bridge.receivePassphrase).toHaveBeenCalledWith({
      passphrase: '',
      switchOnDevice: true,
    });
    expect(harness.modalApi.createGlobalBottomSheetModal).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'ONEKEY_TEMP_PIN_OR_PASSPHRASE',
      }),
    );

    harness.modals['modal-1'].onConfirm('secret', false);

    expect(keyring.bridge.receivePassphrase).toHaveBeenCalledWith({
      passphrase: 'secret',
      switchOnDevice: false,
    });
  });

  it('cancels passphrase requests only for the active passphrase modal', () => {
    const harness = loadHarness();
    const keyring = createOneKeyKeyring();

    harness.bindOneKeyEvents(keyring);
    harness.eventBus.emit(
      harness.EVENTS.ONEKEY.REQUEST_PASSPHRASE,
      requestEvent('c2'),
    );

    harness.dismissListeners[0]('modal-1');

    expect(keyring.bridge.cancel).toHaveBeenCalledWith('c2');
  });
});
