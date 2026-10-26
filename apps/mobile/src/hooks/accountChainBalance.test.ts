import { renderHook } from '@testing-library/react-native';
import type { ChainWithBalance } from '@rabby-wallet/rabby-api/dist/types';
import type { CHAINS_ENUM } from '@/constant/chains';
import type { Account } from '@/core/startupServices/preference';
import {
  getOrderedChainListSnapshot,
  setCurrentCaredAddress,
  useLoadMatteredChainBalances,
} from './accountChainBalance';

const mockChains = [
  { enum: 'ETH', serverId: 'eth', id: 1, name: 'Ethereum' },
  { enum: 'ARB', serverId: 'arb', id: 42161, name: 'Arbitrum' },
  { enum: 'OP', serverId: 'op', id: 10, name: 'Optimism' },
  { enum: 'BSC', serverId: 'bsc', id: 56, name: 'BNB Chain' },
  { enum: 'POLYGON', serverId: 'matic', id: 137, name: 'Polygon' },
];
const mockEmptyChains: ChainWithBalance[] = [];
let mockBalances: Record<string, ChainWithBalance[]> = {};
let mockPinned: CHAINS_ENUM[] = [];
const mockGetPreferenceSnapshot = jest.fn();
const mockGetAddressChainList = jest.fn();

jest.mock('@/constant/chains', () => ({
  getChainList: (network: string) =>
    network === 'mainnet' ? [...mockChains] : [],
}));
jest.mock('@/core/serviceApi/preference', () => ({
  getPreferenceSnapshot: (...args: unknown[]) =>
    mockGetPreferenceSnapshot(...args),
}));
jest.mock('@/core/utils/reexports', () => ({
  zCreate: require('zustand').create,
}));
jest.mock('@/utils/number', () => ({
  coerceFloat: jest.requireActual(
    '../../../../packages/biz-utils/src/isomorphic/biz-number',
  ).coerceFloat,
}));
jest.mock('@/store/balance', () => ({
  __esModule: true,
  default: {
    getAddressChainList: (...args: unknown[]) =>
      mockGetAddressChainList(...args),
    useAddressChainList: (address: string) =>
      mockBalances[address] || mockEmptyChains,
  },
}));
jest.mock('@/store/account', () => ({
  useAccountStore: jest.fn(),
}));

const addressA = '0x00000000000000000000000000000000000000aa';
const addressB = '0x00000000000000000000000000000000000000bb';
const chainEnums = (values: string[]) => values as CHAINS_ENUM[];
const balances = (values: Record<string, number>): ChainWithBalance[] =>
  Object.entries(values).map(([id, usd_value]) => {
    const chain = mockChains.find(item => item.serverId === id)!;
    return {
      id,
      name: chain.name,
      community_id: chain.id,
      logo_url: '',
      native_token_id: id,
      wrapped_token_id: '',
      symbol: chain.enum,
      is_support_history: true,
      born_at: null,
      usd_value,
    };
  });
const enums = (chains: Array<{ enum: CHAINS_ENUM }>) =>
  chains.map(chain => chain.enum);

beforeEach(() => {
  jest.clearAllMocks();
  mockBalances = {};
  mockPinned = [];
  mockGetPreferenceSnapshot.mockImplementation(() => mockPinned);
  mockGetAddressChainList.mockImplementation(
    (address: string) => mockBalances[address] || mockEmptyChains,
  );
  setCurrentCaredAddress('');
});

// Unit contracts: use the real projection, sorting and hook. Public balance
// and preference stores are controlled fixtures, not native persistence proof.
describe('ordered chain snapshot (QA 1054)', () => {
  it('reads the normalized current address synchronously', () => {
    mockBalances[addressA] = balances({ eth: 10 });
    setCurrentCaredAddress(addressA.toUpperCase());

    const snapshot = getOrderedChainListSnapshot({});

    expect(snapshot).not.toBeInstanceOf(Promise);
    expect(mockGetAddressChainList).toHaveBeenLastCalledWith(addressA);
    expect(mockGetPreferenceSnapshot).toHaveBeenCalledWith('pinnedChain');
    expect(enums(snapshot.matteredList)).toEqual(['ETH']);
    expect(snapshot.firstChain?.enum).toBe('ETH');
  });

  it('uses an explicit address without leaking the current address balance', () => {
    mockBalances[addressA] = balances({ eth: 100 });
    mockBalances[addressB] = balances({ arb: 25 });
    setCurrentCaredAddress(addressA);

    const selected = getOrderedChainListSnapshot({
      address: addressB.toUpperCase(),
    });
    expect(mockGetAddressChainList).toHaveBeenLastCalledWith(addressB);
    expect(enums(selected.matteredList)).toEqual(['ARB']);
    expect(enums(getOrderedChainListSnapshot({}).matteredList)).toEqual([
      'ETH',
    ]);
  });

  it('preserves pinned groups before descending USD balances and dust filtering', () => {
    mockPinned = chainEnums(['BSC', 'OP']);
    mockBalances[addressA] = balances({
      eth: 100,
      arb: 200,
      op: 20,
      bsc: 0,
      matic: 0.5,
    });

    const snapshot = getOrderedChainListSnapshot({ address: addressA });

    expect(enums(snapshot.matteredList)).toEqual(['OP', 'BSC', 'ARB', 'ETH']);
    expect(enums(snapshot.unmatteredList)).toEqual(['POLYGON']);
    expect(snapshot.firstChain).toBe(snapshot.matteredList[0]);
  });

  it('retains supported-chain grouping instead of selecting an unsupported balance', () => {
    mockPinned = chainEnums(['OP']);
    mockBalances[addressA] = balances({ eth: 10, arb: 100, op: 50 });

    const snapshot = getOrderedChainListSnapshot({
      address: addressA,
      supportChains: chainEnums(['ETH']),
    });

    expect(enums(snapshot.matteredList)).toEqual(['ETH', 'OP']);
    expect(enums(snapshot.unmatteredList)).toEqual(['ARB', 'BSC', 'POLYGON']);
    expect(snapshot.firstChain?.enum).toBe('ETH');
  });

  it('returns no first chain when no address or balance is available', () => {
    const noAddress = getOrderedChainListSnapshot({});
    expect(mockGetAddressChainList).not.toHaveBeenCalled();
    expect(noAddress.matteredList).toEqual([]);
    expect(noAddress.firstChain).toBeUndefined();
    expect(enums(noAddress.unmatteredList)).toEqual([
      'ARB',
      'BSC',
      'ETH',
      'OP',
      'POLYGON',
    ]);
    expect(getOrderedChainListSnapshot({ address: addressA })).toEqual(
      noAddress,
    );
  });

  it('retains pinned chains if the balance snapshot cannot be read', () => {
    mockPinned = chainEnums(['BSC']);
    mockGetAddressChainList.mockImplementation(() => {
      throw new Error('synthetic unavailable balance snapshot');
    });

    const snapshot = getOrderedChainListSnapshot({ address: addressA });

    expect(enums(snapshot.matteredList)).toEqual(['BSC']);
    expect(snapshot.firstChain?.enum).toBe('BSC');
    expect(enums(snapshot.unmatteredList)).toEqual([
      'ARB',
      'ETH',
      'OP',
      'POLYGON',
    ]);
  });

  it('reads the latest balance and pin snapshots instead of caching an earlier result', () => {
    mockBalances[addressA] = balances({ eth: 10 });
    expect(
      getOrderedChainListSnapshot({ address: addressA }).firstChain?.enum,
    ).toBe('ETH');

    mockBalances[addressA] = balances({ arb: 100 });
    mockPinned = chainEnums(['BSC']);
    expect(
      enums(getOrderedChainListSnapshot({ address: addressA }).matteredList),
    ).toEqual(['BSC', 'ARB']);
  });

  it.each(['available', 'empty', 'unavailable'] as const)(
    'matches the existing async hook reader when balances are %s',
    async state => {
      mockPinned = chainEnums(['BSC']);
      if (state === 'available') {
        mockBalances[addressA] = balances({ eth: 10, arb: 50 });
      } else if (state === 'unavailable') {
        mockGetAddressChainList.mockImplementation(() => {
          throw new Error('synthetic unavailable balance snapshot');
        });
      }
      const { result, unmount } = renderHook(() =>
        useLoadMatteredChainBalances({
          account: { address: addressA.toUpperCase() } as Account,
        }),
      );
      const options = { supportChains: chainEnums(['ETH', 'ARB', 'BSC']) };
      const snapshot = getOrderedChainListSnapshot(options);

      const pending = result.current.fetchOrderedChainList(options);
      expect(pending).toBeInstanceOf(Promise);
      await expect(pending).resolves.toEqual(snapshot);
      await expect(
        result.current.getOrderedChainList(options),
      ).resolves.toEqual(snapshot);
      expect(mockGetAddressChainList).toHaveBeenLastCalledWith(addressA);
      unmount();
    },
  );
});
