function setupOneKeyBridgeModule() {
  jest.resetModules();

  const mockInit = jest.fn(async () => true);
  const mockOn = jest.fn();
  const mockEmit = jest.fn();
  const mockUiResponse = jest.fn();

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
      getDeviceState: jest.fn(),
      uiResponse: mockUiResponse,
      cancel: jest.fn(),
      dispose: jest.fn(),
    },
  }));
  jest.doMock('@onekeyfe/hd-core', () => ({
    UI_EVENT: 'UI_EVENT',
    UI_REQUEST: {
      REQUEST_PIN: 'REQUEST_PIN',
      REQUEST_BUTTON: 'REQUEST_BUTTON',
      REQUEST_PASSPHRASE: 'REQUEST_PASSPHRASE',
      REQUEST_PASSPHRASE_ON_DEVICE: 'REQUEST_PASSPHRASE_ON_DEVICE',
      CLOSE_UI_WINDOW: 'CLOSE_UI_WINDOW',
      CLOSE_UI_PIN_WINDOW: 'CLOSE_UI_PIN_WINDOW',
    },
    UI_RESPONSE: {
      RECEIVE_PIN: 'RECEIVE_PIN',
      RECEIVE_PASSPHRASE: 'RECEIVE_PASSPHRASE',
    },
  }));
  jest.doMock('@/utils/events', () => ({
    EVENT_ONEKEY_REQUEST_PASSPHRASE_ON_DEVICE:
      'ONEKEY_REQUEST_PASSPHRASE_ON_DEVICE',
    EVENT_ONEKEY_CLOSE_UI_PIN_WINDOW: 'ONEKEY_CLOSE_UI_PIN_WINDOW',
    EVENT_ONEKEY_REQUEST_BUTTON: 'ONEKEY_REQUEST_BUTTON',
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
    mockUiResponse,
  };
}

describe('OneKeyBridge', () => {
  afterEach(() => {
    jest.dontMock('@onekeyfe/hd-ble-sdk');
    jest.dontMock('@onekeyfe/hd-core');
    jest.dontMock('@/utils/events');
  });

  it('rejects failed SDK initialization and retries without registering a stale listener', async () => {
    const { OneKeyBridge, mockInit, mockOn } = setupOneKeyBridgeModule();
    mockInit.mockResolvedValueOnce(false);
    const bridge = new OneKeyBridge();
    await expect(bridge.init()).rejects.toThrow(
      'OneKey SDK initialization failed',
    );
    expect(mockOn).not.toHaveBeenCalled();
    await expect(bridge.init()).resolves.toBeUndefined();
    expect(mockOn).toHaveBeenCalledTimes(1);
  });

  it('echoes the SDK correlation when responding to device-side PIN and passphrase requests', () => {
    const { OneKeyBridge, mockUiResponse } = setupOneKeyBridgeModule();
    const bridge = new OneKeyBridge();
    const responseCorrelation = {
      interactionId: 'interaction-id',
      deviceId: 'correlation-device-id',
    };

    bridge.receivePin({ switchOnDevice: true, responseCorrelation });
    expect(mockUiResponse).toHaveBeenLastCalledWith({
      ...responseCorrelation,
      type: 'RECEIVE_PIN',
      payload: '@@ONEKEY_INPUT_PIN_IN_DEVICE',
    });

    bridge.receivePassphrase({
      passphrase: '',
      switchOnDevice: true,
      responseCorrelation,
    });
    expect(mockUiResponse).toHaveBeenLastCalledWith({
      ...responseCorrelation,
      type: 'RECEIVE_PASSPHRASE',
      payload: { value: '', passphraseOnDevice: true, save: true },
    });
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

  it('forwards SDK pin-window close events', async () => {
    const { OneKeyBridge, mockOn, mockEmit } = setupOneKeyBridgeModule();
    const bridge = new OneKeyBridge();

    await bridge.init();

    const event = {
      type: 'CLOSE_UI_PIN_WINDOW',
    };
    mockOn.mock.calls[0][1](event);

    expect(mockEmit).toHaveBeenCalledWith('ONEKEY_CLOSE_UI_PIN_WINDOW', event);
  });

  it('forwards SDK device-button request events', async () => {
    const { OneKeyBridge, mockOn, mockEmit } = setupOneKeyBridgeModule();
    const bridge = new OneKeyBridge();

    await bridge.init();

    const event = {
      type: 'REQUEST_BUTTON',
      payload: {
        device: {
          connectId: 'connect-id',
        },
      },
    };
    mockOn.mock.calls[0][1](event);

    expect(mockEmit).toHaveBeenCalledWith('ONEKEY_REQUEST_BUTTON', event);
  });
});
