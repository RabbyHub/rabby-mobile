import { act, renderHook } from '@testing-library/react-native';
import type {
  PortfolioItem,
  WithdrawAction,
} from '@rabby-wallet/rabby-api/dist/types';
import type { Account } from '@/core/startupServices/preference';
import { openapi } from '@/core/request';
import { toast } from '@/components2024/Toast';
import { useDappAction, useDappActionRequest } from './hook';

jest.mock('@/core/request', () => ({
  openapi: { getProtocol: jest.fn() },
}));
jest.mock('@/core/apis/provider', () => ({
  getERC20Allowance: jest.fn(),
  requestETHRpc: jest.fn().mockResolvedValue('0x'),
}));
jest.mock('@/core/apis/approvals', () => ({ approveToken: jest.fn() }));
jest.mock('@/utils/chain', () => ({
  findChain: () => ({ id: 1, serverId: 'eth', enum: 'ETH' }),
}));
jest.mock('@/constant/chains', () => ({ CHAINS_ENUM: { ETH: 'ETH' } }));
jest.mock('@/constant/swap', () => ({ ETH_USDT_CONTRACT: 'usdt' }));
jest.mock('@/components2024/Toast', () => ({ toast: { error: jest.fn() } }));

const account = {
  address: '0x0000000000000000000000000000000000000001',
} as Account;
const cachedAction = {
  type: 'withdraw',
  contract_id: '0x0000000000000000000000000000000000000002',
  func: 'withdraw(uint256)',
  str_params: ['1'],
} as WithdrawAction;
const portfolio = {
  pool: { id: 'pool', project_id: 'protocol' },
  position_index: 'position',
  withdraw_actions: [cachedAction],
} as PortfolioItem;
const freshAction = {
  ...cachedAction,
  type: 'queue',
  str_params: ['2'],
} as WithdrawAction;
const getProtocol = jest.mocked(openapi.getProtocol);

function useActions() {
  const { action } = useDappAction(cachedAction, 'eth', account);
  return useDappActionRequest(portfolio, account, action);
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

it('uses the last matching fresh position and preserves its queue type', async () => {
  getProtocol.mockResolvedValue({
    portfolio_item_list: [
      portfolio,
      { ...portfolio, withdraw_actions: [freshAction] },
      { ...portfolio, position_index: 'other' },
    ],
  } as Awaited<ReturnType<typeof openapi.getProtocol>>);
  const submit = jest.fn().mockResolvedValue(undefined);
  const { result } = renderHook(useActions);
  await act(async () => {
    await result.current.run('withdraw', submit);
  });
  expect(getProtocol).toHaveBeenCalledWith({
    addr: account.address,
    id: 'protocol',
  });
  expect(submit).toHaveBeenCalledWith(
    [
      expect.objectContaining({
        from: account.address,
        to: freshAction.contract_id,
        data: `0x2e1a7d4d${'2'.padStart(64, '0')}`,
      }),
    ],
    'queue',
  );
  expect(result.current.pending).toBe(false);
});

it.each(
  [
    [],
    [{ ...portfolio, withdraw_actions: [] }],
    [{ ...portfolio, proxy_detail: { proxy_contract_id: account.address } }],
    [
      {
        ...portfolio,
        withdraw_actions: [{ ...cachedAction, func: 'approve(uint256)' }],
      },
    ],
  ].map(portfolio_item_list => ({ portfolio_item_list })),
)(
  'does not fall back to cached actions when fresh data is unavailable or invalid',
  async ({ portfolio_item_list }) => {
    getProtocol.mockResolvedValue({ portfolio_item_list } as Awaited<
      ReturnType<typeof openapi.getProtocol>
    >);
    const submit = jest.fn();
    const { result } = renderHook(useActions);
    await act(async () => {
      await result.current.run('withdraw', submit);
    });
    expect(submit).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('Failed to prepare transaction');
    expect(result.current.pending).toBe(false);
  },
);

it('blocks duplicate requests and releases the lock after a refresh failure', async () => {
  let rejectRefresh!: (error: Error) => void;
  getProtocol.mockImplementation(
    () =>
      new Promise((_, reject) => {
        rejectRefresh = reject;
      }),
  );
  const submit = jest.fn();
  const { result } = renderHook(useActions);
  await act(async () => {
    const first = result.current.run('withdraw', submit);
    await result.current.run('claim', submit);
    expect(getProtocol).toHaveBeenCalledTimes(1);
    rejectRefresh(new Error('Network unavailable'));
    await first;
  });
  expect(submit).not.toHaveBeenCalled();
  expect(result.current.pending).toBe(false);
});
