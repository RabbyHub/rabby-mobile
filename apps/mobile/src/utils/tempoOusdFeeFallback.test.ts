import BigNumber from 'bignumber.js';
import { decodeFunctionData, encodeAbiParameters, parseAbi } from 'viem';

import {
  TEMPO_FEE_MANAGER_ADDRESS,
  TEMPO_OUSD_TOKEN,
  TEMPO_PATH_USD_TOKEN,
} from '@/constant/tempo';
import { requestReadOnlyETHRpc } from '@/core/apis/readOnlyRpc';
import { openapi } from '@/core/request';
import type { Account } from '@/types/account';
import type { TempoFeeTokenOption } from './tempo';
import {
  listTempoFeeTokenOptionsFromCache,
  loadTempoFeeTokenOptionsState,
  pickTempoProtocolFallbackFeeTokenId,
  resolveTempoProtocolFallbackGasToken,
  shouldUseTempoProtocolFeeTokenFallback,
} from './tempo';

jest.mock('@/core/apis/readOnlyRpc', () => ({
  requestReadOnlyETHRpc: jest.fn(),
}));
jest.mock('@/core/request', () => ({
  openapi: {
    getToken: jest.fn(),
    listToken: jest.fn(),
  },
}));

const USER = '0x1111111111111111111111111111111111111111';
const USDCE = '0x20c000000000000000000000b9537d11c60e8b50';
const ZERO = '0x0000000000000000000000000000000000000000';
const account = { address: USER, type: 'SimpleKeyring' } as Account;
const erc20Abi = parseAbi([
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
]);

const mockedRpc = requestReadOnlyETHRpc as jest.MockedFunction<
  typeof requestReadOnlyETHRpc
>;
const mockedOpenapi = openapi as unknown as {
  getToken: jest.Mock;
  listToken: jest.Mock;
};

/**
 * Chain stub: FeeManager returns `preference` (zero address = none), TIP-20
 * `balanceOf` returns `balances[token]`, and the DeBank API knows nothing, so
 * every balance is read on chain.
 */
const setupChain = ({
  preference = ZERO,
  balances = {},
}: {
  preference?: string;
  balances?: Record<string, bigint>;
}) => {
  mockedRpc.mockImplementation((async ({ params }: { params: any[] }) => {
    const [{ to, data }] = params;
    if (to.toLowerCase() === TEMPO_FEE_MANAGER_ADDRESS) {
      return encodeAbiParameters([{ type: 'address' }], [preference as any]);
    }
    const { functionName } = decodeFunctionData({ abi: erc20Abi, data });
    if (functionName === 'decimals') {
      return encodeAbiParameters([{ type: 'uint8' }], [6]);
    }
    if (functionName === 'symbol') {
      throw new Error('no symbol');
    }
    return encodeAbiParameters(
      [{ type: 'uint256' }],
      [balances[to.toLowerCase()] ?? 0n],
    );
  }) as any);
};

const loadState = (
  overrides: Partial<Parameters<typeof loadTempoFeeTokenOptionsState>[0]> = {},
) =>
  loadTempoFeeTokenOptionsState({
    account,
    userAddress: USER,
    chainServerId: 'tempo',
    maxGasCostRawAmount: new BigNumber(1000),
    maxGasCostRawAmountDecimals: 6,
    ...overrides,
  });

const same = (a?: string | null, b?: string | null) =>
  (a || '').toLowerCase() === (b || '').toLowerCase();

beforeEach(() => {
  mockedRpc.mockReset();
  mockedOpenapi.getToken.mockReset().mockRejectedValue(new Error('none'));
  mockedOpenapi.listToken.mockReset().mockResolvedValue([]);
});

describe('Tempo OUSD protocol fee token fallback', () => {
  it('offers OUSD in the gas token picker', () => {
    const options = listTempoFeeTokenOptionsFromCache({
      chainServerId: 'tempo',
    });
    const ousd = options.find(item => same(item.id, TEMPO_OUSD_TOKEN));
    expect(ousd?.symbol).toBe('OUSD');
  });

  it('applies the fallback only without feeToken and stored preference', () => {
    expect(
      shouldUseTempoProtocolFeeTokenFallback({ chainServerId: 'tempo' }),
    ).toBe(true);
    expect(
      shouldUseTempoProtocolFeeTokenFallback({
        chainServerId: 'tempo',
        txFeeToken: TEMPO_PATH_USD_TOKEN,
      }),
    ).toBe(false);
    expect(
      shouldUseTempoProtocolFeeTokenFallback({
        chainServerId: 'tempo',
        hasUserFeeTokenPreference: true,
      }),
    ).toBe(false);
    expect(
      shouldUseTempoProtocolFeeTokenFallback({ chainServerId: 'eth' }),
    ).toBe(false);
  });

  it('picks pathUSD before OUSD, and nothing when neither covers the fee', () => {
    const option = (id: string, disabled: boolean) =>
      ({ id, isDisabledByTempoGasBalance: disabled } as TempoFeeTokenOption);
    expect(
      pickTempoProtocolFallbackFeeTokenId([
        option(TEMPO_OUSD_TOKEN, false),
        option(TEMPO_PATH_USD_TOKEN, false),
      ]),
    ).toBe(TEMPO_PATH_USD_TOKEN);
    expect(
      pickTempoProtocolFallbackFeeTokenId([
        option(TEMPO_PATH_USD_TOKEN, true),
        option(TEMPO_OUSD_TOKEN, false),
      ]),
    ).toBe(TEMPO_OUSD_TOKEN);
    expect(
      pickTempoProtocolFallbackFeeTokenId([
        option(TEMPO_PATH_USD_TOKEN, true),
        option(TEMPO_OUSD_TOKEN, true),
        option(USDCE, false),
      ]),
    ).toBeNull();
  });

  describe('loadTempoFeeTokenOptionsState', () => {
    it('keeps pathUSD when it covers the max fee', async () => {
      setupChain({
        balances: {
          [TEMPO_PATH_USD_TOKEN]: 5000n,
          [TEMPO_OUSD_TOKEN]: 5000n,
        },
      });
      const state = await loadState();
      expect(state.hasUserFeeTokenPreference).toBe(false);
      expect(same(state.preferredTokenId, TEMPO_PATH_USD_TOKEN)).toBe(true);
      expect(same(state.selectedOption?.id, TEMPO_PATH_USD_TOKEN)).toBe(true);
    });

    it('predicts OUSD for an OUSD-only user', async () => {
      setupChain({ balances: { [TEMPO_OUSD_TOKEN]: 5000n } });
      const state = await loadState();
      expect(same(state.preferredTokenId, TEMPO_OUSD_TOKEN)).toBe(true);
      expect(same(state.selectedOption?.id, TEMPO_OUSD_TOKEN)).toBe(true);
    });

    it('stays on pathUSD when neither token covers the max fee', async () => {
      setupChain({
        balances: { [TEMPO_PATH_USD_TOKEN]: 10n, [TEMPO_OUSD_TOKEN]: 10n },
      });
      const state = await loadState();
      expect(same(state.preferredTokenId, TEMPO_PATH_USD_TOKEN)).toBe(true);
      expect(state.selectedOption).toBeUndefined();
    });

    it('a stored preference disables the fallback', async () => {
      setupChain({
        preference: USDCE,
        balances: { [TEMPO_OUSD_TOKEN]: 5000n },
      });
      const state = await loadState();
      expect(state.hasUserFeeTokenPreference).toBe(true);
      expect(same(state.preferredTokenId, USDCE)).toBe(true);
    });

    it('an explicit tx feeToken disables the fallback', async () => {
      setupChain({ balances: { [TEMPO_OUSD_TOKEN]: 5000n } });
      const state = await loadState({ txFeeToken: TEMPO_PATH_USD_TOKEN });
      expect(same(state.preferredTokenId, TEMPO_PATH_USD_TOKEN)).toBe(true);
    });

    it('honours a passed-in preference flag for a pathUSD current token', async () => {
      setupChain({ balances: { [TEMPO_OUSD_TOKEN]: 5000n } });
      const withPreference = await loadState({
        currentFeeTokenId: TEMPO_PATH_USD_TOKEN,
        hasUserFeeTokenPreference: true,
      });
      expect(same(withPreference.preferredTokenId, TEMPO_PATH_USD_TOKEN)).toBe(
        true,
      );

      const withoutPreference = await loadState({
        currentFeeTokenId: TEMPO_PATH_USD_TOKEN,
        hasUserFeeTokenPreference: false,
      });
      expect(same(withoutPreference.preferredTokenId, TEMPO_OUSD_TOKEN)).toBe(
        true,
      );
    });
  });

  describe('resolveTempoProtocolFallbackGasToken', () => {
    const pathUsdBalance = (rawBalance: string, isUserPreference = false) => ({
      rawBalance,
      token: {
        tokenId: TEMPO_PATH_USD_TOKEN,
        symbol: 'pathUSD',
        decimals: 6,
      },
      isTempoUserFeeTokenPreference: isUserPreference,
    });
    const resolve = (
      gasTokenBalance: ReturnType<typeof pathUsdBalance>,
      txFeeToken?: string,
    ) =>
      resolveTempoProtocolFallbackGasToken({
        account,
        address: USER,
        chainServerId: 'tempo',
        gasTokenBalance,
        txFeeToken,
        maxGasCostRawAmount: new BigNumber(1000),
      });

    it('switches to OUSD when pathUSD cannot cover the max fee', async () => {
      setupChain({ balances: { [TEMPO_OUSD_TOKEN]: 5000n } });
      const result = await resolve(pathUsdBalance('0'));
      expect(same(result.token.tokenId, TEMPO_OUSD_TOKEN)).toBe(true);
      expect(result.token.symbol).toBe('OUSD');
      expect(result.rawBalance).toBe('5000');
    });

    it('keeps pathUSD without extra reads when it covers the max fee', async () => {
      setupChain({});
      const input = pathUsdBalance('5000');
      expect(await resolve(input)).toBe(input);
      expect(mockedRpc).not.toHaveBeenCalled();
    });

    it('keeps pathUSD when OUSD cannot cover the max fee either', async () => {
      setupChain({ balances: { [TEMPO_OUSD_TOKEN]: 10n } });
      const input = pathUsdBalance('0');
      expect(await resolve(input)).toBe(input);
    });

    it('no fallback with a stored preference or an explicit feeToken', async () => {
      setupChain({ balances: { [TEMPO_OUSD_TOKEN]: 5000n } });
      const preferred = pathUsdBalance('0', true);
      expect(await resolve(preferred)).toBe(preferred);

      const explicit = pathUsdBalance('0');
      expect(await resolve(explicit, TEMPO_PATH_USD_TOKEN)).toBe(explicit);
      expect(mockedRpc).not.toHaveBeenCalled();
    });
  });
});
