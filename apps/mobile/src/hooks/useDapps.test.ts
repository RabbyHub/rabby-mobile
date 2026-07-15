import { useDappAccountResolver } from './useDapps';

const mockGetDappAccount = jest.fn();
const mockUseCoreServiceDependencies = jest.fn();

jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useCallback: <T extends (...args: any[]) => any>(callback: T) => callback,
}));

jest.mock('@/core/apis/dapp', () => ({
  createDappBySession: jest.fn(),
}));

jest.mock('./account', () => ({
  useAccounts: jest.fn(),
}));

jest.mock('@/core/utils/reexports', () => ({
  zCreate: () => {
    const store = jest.fn();
    store.setState = jest.fn();
    return store;
  },
}));

jest.mock('@/core/utils/dappAccount', () => ({
  getDappAccount: (...args: unknown[]) => mockGetDappAccount(...args),
}));

jest.mock('@/core/serviceApi/serviceDependencies', () => ({
  runWithCoreServices: jest.fn(),
  serviceDependency: (name: string) => ({ name }),
  useCoreServiceDependencies: (...args: unknown[]) =>
    mockUseCoreServiceDependencies(...args),
}));

describe('useDappAccountResolver', () => {
  const dappInfo = {
    origin: 'https://example.test',
    currentAccount: {
      address: '0x1111111111111111111111111111111111111111',
      type: 'Simple Key Pair',
    },
  };
  const accounts = [dappInfo.currentAccount];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('resolves the persisted DApp account while transaction history is loading', () => {
    mockUseCoreServiceDependencies.mockReturnValue({ status: 'loading' });
    mockGetDappAccount.mockReturnValue(accounts[0]);

    const resolveAccount = useDappAccountResolver();

    expect(resolveAccount({ dappInfo, accounts } as any)).toBe(accounts[0]);
    expect(mockGetDappAccount).toHaveBeenCalledWith({
      dappInfo,
      accounts,
      transactions: [],
    });
  });

  it('uses transaction history after the service becomes ready', () => {
    const transactions = [
      {
        address: '0x2222222222222222222222222222222222222222',
        createdAt: 1,
      },
    ];
    mockUseCoreServiceDependencies.mockReturnValue({
      status: 'ready',
      services: {
        transactionHistoryService: {
          store: { transactions },
        },
      },
    });

    const resolveAccount = useDappAccountResolver();
    resolveAccount({ dappInfo, accounts } as any);

    expect(mockGetDappAccount).toHaveBeenCalledWith({
      dappInfo,
      accounts,
      transactions,
    });
  });
});
