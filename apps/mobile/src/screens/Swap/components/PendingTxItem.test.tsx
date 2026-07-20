import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

const mockGetList = jest.fn();
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

jest.mock('@/core/services', () => ({
  bridgeService: {},
  swapService: {
    setOpenSwapHistoryTs: jest.fn(),
  },
  transactionHistoryService: {
    getList: (...args: unknown[]) => mockGetList(...args),
  },
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

    mockGetList.mockReturnValue({
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

    expect(mockGetList).toHaveBeenCalledWith(approveData.address);
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
});
