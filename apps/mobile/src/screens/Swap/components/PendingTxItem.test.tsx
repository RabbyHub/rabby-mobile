import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

const mockGetListSnapshot = jest.fn();
const mockNaviPush = jest.fn();

jest.mock('@/components', () => ({
  AssetAvatar: () => null,
}));

jest.mock('@/components/Chain/ChainIconImage', () => () => null);

jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));

jest.mock('@/components2024/Toast', () => ({
  toast: {},
}));

jest.mock('@/constant/layout', () => ({
  RootNames: {
    StackTransaction: 'StackTransaction',
    HistoryLocalDetail: 'HistoryLocalDetail',
  },
}));

jest.mock('@/core/serviceApi/swap', () => ({
  swapServiceApi: {
    setOpenSwapHistoryTs: jest.fn(),
  },
}));

jest.mock('@/core/serviceApi/transactionHistory', () => ({
  getTransactionHistoryListSnapshot: (...args: unknown[]) =>
    mockGetListSnapshot(...args),
  transactionHistoryServiceApi: {},
}));

jest.mock('@/hooks/accountsSwitcher', () => ({
  switchSceneCurrentAccount: jest.fn(),
  useSceneAccountInfo: () => ({
    finalSceneCurrentAccount: {
      address: '0xscene-account',
    },
  }),
}));

jest.mock('@/hooks/theme', () => ({
  useTheme2024: () => ({
    styles: {},
    colors2024: {},
  }),
}));

jest.mock('@/screens/Transaction/components/TxStatusItem', () => ({
  TxStatusItem: () => null,
}));

jest.mock('@/utils/chain', () => ({
  findChain: () => ({
    name: 'HyperEVM',
    serverId: 'hyper',
  }),
}));

jest.mock('@/utils/navigation', () => ({
  naviPush: (...args: unknown[]) => mockNaviPush(...args),
}));

jest.mock('@/utils/number', () => ({
  formatTokenAmount: (value: number) => String(value),
}));

jest.mock('@/utils/styles', () => ({
  createGetStyles2024: () => () => ({}),
}));

jest.mock('@/utils/token', () => ({
  getTokenSymbol: (token: { symbol?: string }) => token?.symbol || '',
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const { PendingTxItem } =
  require('./PendingTxItem') as typeof import('./PendingTxItem');

describe('PendingTxItem', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('opens the local approval transaction detail when an approveSwap item is pressed', () => {
    const approveData = {
      address: '0xapprove-account',
      chainId: 999,
      amount: 1,
      token: {
        symbol: 'USDC',
      },
      status: 'pending',
      hash: '0xapprove-hash',
      createdAt: 1,
    } as any;
    const groupData = {
      chainId: approveData.chainId,
      txs: [{ hash: approveData.hash }],
    } as any;

    mockGetListSnapshot.mockReturnValue({
      pendings: [groupData],
      completeds: [],
    });

    render(
      <PendingTxItem
        type="approveSwap"
        data={approveData}
        clearLocalPendingTxData={jest.fn()}
        isForMultipleAddress={false}
      />,
    );

    fireEvent.press(screen.getByText('Approval 1 USDC'));

    expect(mockGetListSnapshot).toHaveBeenCalledWith(approveData.address);
    expect(mockNaviPush).toHaveBeenCalledWith('StackTransaction', {
      screen: 'HistoryLocalDetail',
      params: {
        isForMultipleAddress: false,
        data: groupData,
        type: 'approve',
        title: 'page.transactions.itemTitle.Approve',
        account: undefined,
      },
    });
  });

  it('truncates long swap token symbols within the pending row', () => {
    const fromSymbol = 'VERY_LONG_FROM_TOKEN_SYMBOL';
    const toSymbol = 'VERY_LONG_TO_TOKEN_SYMBOL';
    const swapData = {
      address: '0xswap-account',
      chainId: 999,
      fromToken: {
        symbol: fromSymbol,
        chain: 'hyper',
      },
      toToken: {
        symbol: toSymbol,
        chain: 'hyper',
      },
      status: 'pending',
      hash: '0xswap-hash',
      createdAt: 1,
    } as any;

    render(
      <PendingTxItem
        type="swap"
        data={swapData}
        clearLocalPendingTxData={jest.fn()}
        isForMultipleAddress={false}
      />,
    );

    expect(screen.getByText(fromSymbol)).toHaveProp('numberOfLines', 1);
    expect(screen.getByText(fromSymbol)).toHaveProp('ellipsizeMode', 'tail');
    expect(screen.getByText(toSymbol)).toHaveProp('numberOfLines', 1);
    expect(screen.getByText(toSymbol)).toHaveProp('ellipsizeMode', 'tail');
  });
});
