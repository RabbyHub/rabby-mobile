import * as Sentry from '@sentry/react-native';
import type { BridgeApi } from '@rabby-wallet/rabby-bridge';
import { buildBridgeTx, getBridgeQuoteList } from './bridgeSdk';

jest.mock('@sentry/react-native', () => ({ captureException: jest.fn() }));
jest.mock('@rabby-wallet/rabby-bridge', () => ({
  __esModule: true,
  getQuoteList: jest.fn(),
  buildTx: jest.fn(),
  toBridgeErrorReport: jest.fn(),
}));

const sdk = jest.requireMock('@rabby-wallet/rabby-bridge') as {
  getQuoteList: jest.Mock;
  buildTx: jest.Mock;
  toBridgeErrorReport?: jest.Mock;
};
const params = {
  userAddress: '0x1111111111111111111111111111111111111111',
  fromChainId: 'eth',
  fromTokenId: 'eth',
  fromTokenRawAmount: '1000000000000000000',
  toChainId: 'base',
  toTokenId: 'base',
  toTokenRawAmount: '0x0de0b6b3a7640000',
  slippage: '0.01',
  bridgeId: 'across',
};
const api = {} as BridgeApi;
const tx = { to: 'router', data: '0x', value: '0x0' };
const detail = {
  error_code: 'BRIDGE_RECEIVER_MISMATCH',
  stage: 'intent',
  operation: 'buildTx',
  aggregatorId: 'across',
  chainId: 'eth',
  toChainId: 'base',
  bridgeId: 'across',
  selector: '0xea86bd46',
  protocolSelector: '0x11111111',
  destinationSelectors: ['0xa9059cbb', '0xef8738d3'],
  pass: true,
  routerPass: true,
  fromPass: true,
  toPass: true,
  receiverPass: false,
  blocking: false,
};
const report = {
  error_code: detail.error_code,
  stage: detail.stage,
  errors: [detail],
};
const reportWith = (changes: Partial<typeof detail>) => ({
  ...report,
  errors: [{ ...detail, ...changes }],
});
const emitOnBuild = (value: unknown) => {
  sdk.toBridgeErrorReport!.mockReturnValue(value);
  sdk.buildTx.mockImplementation(async (_aggregatorId, options) => {
    options.onError(value);
    return tx;
  });
};

beforeEach(() => {
  jest.resetAllMocks();
});

it('passes the exact quoted raw amount and preserves a successful transaction', async () => {
  sdk.buildTx.mockResolvedValue(tx);
  await expect(buildBridgeTx('across', params, api)).resolves.toBe(tx);
  expect(sdk.buildTx).toHaveBeenCalledWith(
    'across',
    expect.objectContaining({
      ...params,
      lite: true,
      onError: expect.any(Function),
    }),
    api,
  );
  expect(Sentry.captureException).not.toHaveBeenCalled();
});

it('preserves quotes while wiring only validation reporting', async () => {
  const quotes = [{ bridge_id: 'across' }];
  sdk.getQuoteList.mockResolvedValue(quotes);
  await expect(getBridgeQuoteList('across', params, api)).resolves.toBe(quotes);
  expect(sdk.getQuoteList.mock.calls[0][1].onError).toEqual(
    expect.any(Function),
  );
  expect(Sentry.captureException).not.toHaveBeenCalled();
});

it('uses only sanitized data and preserves the transaction when Sentry fails', async () => {
  const safe = reportWith({ selector: '0x11111111' });
  const raw = {
    ...safe,
    wallet: params.userAddress,
    calldata: 'private calldata',
  };
  emitOnBuild(raw);
  sdk.toBridgeErrorReport!.mockReturnValue(safe);
  (Sentry.captureException as jest.Mock).mockImplementation(() => {
    throw new Error('report failure');
  });
  await expect(buildBridgeTx('across', params, api)).resolves.toBe(tx);
  expect(Sentry.captureException).toHaveBeenCalledWith(
    expect.any(Error),
    expect.objectContaining({
      extra: { bridge_sdk: safe },
    }),
  );
  const calls = JSON.stringify(
    (Sentry.captureException as jest.Mock).mock.calls,
  );
  expect(calls).not.toContain(params.userAddress);
  expect(calls).not.toContain('private calldata');
});

it('keeps thrown quote and build request failures on their original business path without reporting', async () => {
  const error = new Error('private transport details');
  sdk.toBridgeErrorReport!.mockReturnValue({
    error_code: 'BRIDGE_BACKEND_BUILD_REQUEST_FAILED',
    stage: 'provider_request',
    errors: [
      {
        ...detail,
        error_code: 'BRIDGE_BACKEND_BUILD_REQUEST_FAILED',
        stage: 'provider_request',
        blocking: true,
      },
    ],
  });
  sdk.getQuoteList.mockRejectedValue(error);
  sdk.buildTx.mockRejectedValue(error);
  await expect(getBridgeQuoteList('across', params, api)).rejects.toBe(error);
  await expect(buildBridgeTx('across', params, api)).rejects.toBe(error);
  expect(Sentry.captureException).not.toHaveBeenCalled();
});

it.each([
  { stage: 'provider_request' },
  { operation: 'getQuote' },
  { blocking: true },
])('does not report non-calldata observations: %j', async changes => {
  emitOnBuild(reportWith(changes));
  await expect(buildBridgeTx('across', params, api)).resolves.toBe(tx);
  expect(Sentry.captureException).not.toHaveBeenCalled();
});

it('filters mixed reports before selecting their primary error', async () => {
  const calldata = { ...detail, selector: '0x22222222' };
  emitOnBuild({
    error_code: 'BRIDGE_BACKEND_BUILD_REQUEST_FAILED',
    stage: 'provider_request',
    errors: [
      {
        ...calldata,
        error_code: 'BRIDGE_BACKEND_BUILD_REQUEST_FAILED',
        stage: 'provider_request',
      },
      calldata,
    ],
  });
  await buildBridgeTx('across', params, api);
  expect(Sentry.captureException).toHaveBeenCalledWith(
    expect.any(Error),
    expect.objectContaining({
      extra: {
        bridge_sdk: {
          error_code: calldata.error_code,
          stage: calldata.stage,
          errors: [calldata],
        },
      },
    }),
  );
});

it('reports the same diagnostic once across refreshes, duplicate details and changed wallet or amount', async () => {
  const repeated = { ...detail, selector: '0x33333333' };
  emitOnBuild({ ...report, errors: [repeated, repeated] });
  await buildBridgeTx('across', params, api);
  await buildBridgeTx(
    'across',
    { ...params, userAddress: 'another-wallet', fromTokenRawAmount: '2' },
    api,
  );
  expect(Sentry.captureException).toHaveBeenCalledTimes(1);
  expect(
    (Sentry.captureException as jest.Mock).mock.calls[0][1].extra.bridge_sdk
      .errors,
  ).toEqual([repeated]);
});

it('retains a new failure on an already observed path without uploading the old failure again', async () => {
  const receiver = { ...detail, selector: '0x44444444' };
  emitOnBuild({ ...report, errors: [receiver] });
  await buildBridgeTx('across', params, api);
  const source = {
    ...receiver,
    error_code: 'BRIDGE_FROM_TOKEN_MISMATCH',
    fromPass: false,
  };
  emitOnBuild({ ...report, errors: [source, receiver] });
  await buildBridgeTx('across', params, api);
  expect(Sentry.captureException).toHaveBeenCalledTimes(2);
  expect(
    (Sentry.captureException as jest.Mock).mock.calls[1][1].extra.bridge_sdk,
  ).toEqual({
    error_code: source.error_code,
    stage: source.stage,
    errors: [source],
  });
});

it('retains different inner paths while ignoring destination-selector ordering', async () => {
  const first = reportWith({
    selector: '0x55555555',
    protocolSelector: '0xaaaaaaaa',
  });
  emitOnBuild(first);
  await buildBridgeTx('across', params, api);
  emitOnBuild(
    reportWith({ selector: '0x55555555', protocolSelector: '0xbbbbbbbb' }),
  );
  await buildBridgeTx('across', params, api);
  emitOnBuild({
    ...first,
    errors: [
      {
        ...first.errors[0],
        destinationSelectors: [...detail.destinationSelectors].reverse(),
      },
    ],
  });
  await buildBridgeTx('across', params, api);
  expect(Sentry.captureException).toHaveBeenCalledTimes(2);
});

it('retains local LayerSwap value validation despite its historical provider-response stage', async () => {
  const local = reportWith({
    selector: '0x66666666',
    error_code: 'BRIDGE_LAYERSWAP_SOURCE_VALUE_MISMATCH',
    stage: 'provider_response',
    fromPass: false,
  });
  emitOnBuild(local);
  await expect(buildBridgeTx('across', params, api)).resolves.toBe(tx);
  expect(Sentry.captureException).toHaveBeenCalledTimes(1);
});

it('retains whitelist rejection reporting and the original blocking error', async () => {
  const error = new Error('router rejected');
  const rejected = reportWith({
    selector: '0x77777777',
    error_code: 'BRIDGE_ROUTER_NOT_ALLOWED',
    stage: 'contract',
    blocking: true,
    pass: false,
    routerPass: false,
  });
  sdk.toBridgeErrorReport!.mockReturnValue(rejected);
  sdk.buildTx.mockRejectedValue(error);
  await expect(buildBridgeTx('across', params, api)).rejects.toBe(error);
  expect(Sentry.captureException).toHaveBeenCalledTimes(1);
});

it('keeps 0.0.12 usable until the package is upgraded', async () => {
  const convert = sdk.toBridgeErrorReport;
  delete sdk.toBridgeErrorReport;
  try {
    sdk.buildTx.mockResolvedValue(tx);
    await expect(buildBridgeTx('across', params, api)).resolves.toBe(tx);
    const error = new Error('legacy SDK failure');
    sdk.buildTx.mockRejectedValue(error);
    await expect(buildBridgeTx('across', params, api)).rejects.toBe(error);
    expect(Sentry.captureException).not.toHaveBeenCalled();
  } finally {
    sdk.toBridgeErrorReport = convert;
  }
});
