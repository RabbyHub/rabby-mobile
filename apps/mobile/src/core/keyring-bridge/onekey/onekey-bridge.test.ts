function setupOneKeyBridgeModule() {
  jest.resetModules();

  const mockInit = jest.fn(async () => undefined);
  const mockOn = jest.fn();
  const mockEmit = jest.fn();

  jest.doMock('@onekeyfe/hd-ble-sdk', () => ({
    __esModule: true,
    default: {
      init: mockInit,
      on: mockOn,
      evmSignTransaction: jest.fn(),
      evmSignMessage: jest.fn(),
      evmSignTypedData: jest.fn(),
      searchDevices: jest.fn(),
      getPassphraseState: jest.fn(),
      evmGetPublicKey: jest.fn(),
      getFeatures: jest.fn(),
      uiResponse: jest.fn(),
      cancel: jest.fn(),
      dispose: jest.fn(),
    },
  }));
  jest.doMock('@onekeyfe/hd-core', () => ({
    UI_EVENT: 'UI_EVENT',
    UI_REQUEST: {
      REQUEST_PIN: 'REQUEST_PIN',
      REQUEST_PASSPHRASE: 'REQUEST_PASSPHRASE',
      REQUEST_PASSPHRASE_ON_DEVICE: 'REQUEST_PASSPHRASE_ON_DEVICE',
      CLOSE_UI_WINDOW: 'CLOSE_UI_WINDOW',
    },
    UI_RESPONSE: {
      RECEIVE_PIN: 'RECEIVE_PIN',
      RECEIVE_PASSPHRASE: 'RECEIVE_PASSPHRASE',
    },
  }));
  jest.doMock('@/utils/events', () => ({
    EVENT_ONEKEY_REQUEST_PASSPHRASE_ON_DEVICE:
      'ONEKEY_REQUEST_PASSPHRASE_ON_DEVICE',
    eventBus: {
      emit: mockEmit,
    },
    EVENTS: {
      ONEKEY: {
        REQUEST_PIN: 'ONEKEY_REQUEST_PIN',
        REQUEST_PASSPHRASE: 'ONEKEY_REQUEST_PASSPHRASE',
        CLOSE_UI_WINDOW: 'ONEKEY_CLOSE_UI_WINDOW',
      },
    },
  }));

  const OneKeyBridge = require('./onekey-bridge')
    .default as typeof import('./onekey-bridge').default;

  return {
    OneKeyBridge,
    mockInit,
    mockOn,
    mockEmit,
  };
}

describe('OneKeyBridge', () => {
  afterEach(() => {
    jest.dontMock('@onekeyfe/hd-ble-sdk');
    jest.dontMock('@onekeyfe/hd-core');
    jest.dontMock('@/utils/events');
  });

  it('initializes SDK listeners once and forwards device-side passphrase events', async () => {
    const { OneKeyBridge, mockInit, mockOn, mockEmit } =
      setupOneKeyBridgeModule();
    const bridge = new OneKeyBridge();

    await bridge.init();
    await bridge.init();

    expect(mockInit).toHaveBeenCalledTimes(1);
    expect(mockOn).toHaveBeenCalledTimes(1);

    const event = {
      type: 'REQUEST_PASSPHRASE_ON_DEVICE',
      payload: {
        device: {
          connectId: 'connect-id',
        },
      },
    };
    mockOn.mock.calls[0][1](event);

    expect(mockEmit).toHaveBeenCalledWith(
      'ONEKEY_REQUEST_PASSPHRASE_ON_DEVICE',
      event,
    );
  });
});
