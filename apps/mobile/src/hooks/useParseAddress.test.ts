import { renderHook, waitFor } from '@testing-library/react-native';

import { apiProvider } from '@/core/apis';
import { openapi, testOpenapi } from '@/core/request';
import { AddressType } from '@/utils/address';
import {
  useCheckAddressType,
  useParseContractAddress,
} from './useParseAddress';
import { formatTxExplainAbiData } from '../utils/transaction';

jest.mock('@/core/apis', () => ({
  apiProvider: {
    requestETHRpc: jest.fn(),
    getRecommendNonce: jest.fn(),
  },
}));

jest.mock('@/core/request', () => ({
  openapi: {
    preExecTx: jest.fn(),
  },
  testOpenapi: {
    preExecTx: jest.fn(),
  },
}));

jest.mock('@/constant', () => ({
  INTERNAL_REQUEST_ORIGIN: 'rabby-internal',
}));

jest.mock('../utils/transaction', () => ({
  formatTxExplainAbiData: jest.fn(() => 'transfer(address,uint256)'),
}));

const requestETHRpc = apiProvider.requestETHRpc as jest.Mock;
const getRecommendNonce = apiProvider.getRecommendNonce as jest.Mock;
const preExecTx = openapi.preExecTx as jest.Mock;
const testnetPreExecTx = testOpenapi.preExecTx as jest.Mock;
const formatAbi = formatTxExplainAbiData as jest.Mock;

const account = {
  address: '0x1111111111111111111111111111111111111111',
  type: 'HD Key Tree',
};
const chain = {
  id: 1,
  enum: 'ETH',
  serverId: 'eth',
  network: '1',
};

describe('useParseAddress', () => {
  const consoleError = console.error;
  let consoleErrorMock: jest.SpyInstance;

  beforeAll(() => {
    consoleErrorMock = jest
      .spyOn(console, 'error')
      .mockImplementation((message, ...rest) => {
        const text = [message, ...rest].map(item => String(item)).join(' ');
        if (text.includes('not wrapped in act')) {
          return;
        }

        consoleError(message, ...rest);
      });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    consoleErrorMock.mockRestore();
  });

  describe('useCheckAddressType', () => {
    it('classifies valid addresses as EOA or contract from eth_getCode', async () => {
      requestETHRpc.mockResolvedValueOnce('0x');
      const { result, rerender } = renderHook(
        ({ addr }) => useCheckAddressType(addr, chain, account as never),
        {
          initialProps: {
            addr: '0x2222222222222222222222222222222222222222',
          },
        },
      );

      await waitFor(() => {
        expect(result.current.addressType).toBe(AddressType.EOA);
      });
      expect(requestETHRpc).toHaveBeenCalledWith(
        {
          method: 'eth_getCode',
          params: ['0x2222222222222222222222222222222222222222', 'latest'],
        },
        'eth',
        account,
      );

      requestETHRpc.mockResolvedValueOnce('0x60016001');
      rerender({
        addr: '0x3333333333333333333333333333333333333333',
      });

      await waitFor(() => {
        expect(result.current.addressType).toBe(AddressType.CONTRACT);
      });
    });

    it('returns UNKNOWN without RPC for missing chain or invalid address', async () => {
      const { result } = renderHook(() =>
        useCheckAddressType('not-an-address', chain, account as never),
      );

      await waitFor(() => {
        expect(result.current.addressType).toBe(AddressType.UNKNOWN);
      });
      expect(requestETHRpc).not.toHaveBeenCalled();
    });

    it('falls back to UNKNOWN when eth_getCode fails', async () => {
      requestETHRpc.mockRejectedValue(new Error('rpc down'));

      const { result } = renderHook(() =>
        useCheckAddressType(
          '0x2222222222222222222222222222222222222222',
          chain,
          account as never,
        ),
      );

      await waitFor(() => {
        expect(result.current.addressType).toBe(AddressType.UNKNOWN);
      });
    });
  });

  describe('useParseContractAddress', () => {
    it('skips preExec when required inputs are missing', async () => {
      const { result } = renderHook(() =>
        useParseContractAddress({
          contractAddress: '',
          userAddress: account.address,
          chain: chain as never,
          inputDataHex: '0x1234',
          account,
        }),
      );

      await waitFor(() => {
        expect(result.current.isLoadingExplain).toBe(false);
      });
      expect(result.current.explain).toBeNull();
      expect(getRecommendNonce).not.toHaveBeenCalled();
      expect(preExecTx).not.toHaveBeenCalled();
    });

    it('pre-executes mainnet contract calls and formats ABI plain text', async () => {
      getRecommendNonce.mockResolvedValue('0x7');
      preExecTx.mockResolvedValue({
        abi: {
          func: 'transfer',
        },
      });

      const { result } = renderHook(() =>
        useParseContractAddress({
          contractAddress: '0x3333333333333333333333333333333333333333',
          userAddress: account.address,
          chain: chain as never,
          inputDataHex: '0xa9059cbb',
          account,
        }),
      );

      await waitFor(() => {
        expect(result.current.contractCallPlainText).toBe(
          'transfer(address,uint256)',
        );
      });
      expect(getRecommendNonce).toHaveBeenCalledWith({
        from: account.address,
        chainId: 1,
        account,
      });
      expect(preExecTx).toHaveBeenCalledWith(
        expect.objectContaining({
          tx: expect.objectContaining({
            chainId: 1,
            from: account.address,
            to: '0x3333333333333333333333333333333333333333',
            data: '0xa9059cbb',
            value: '0xa9059cbb',
            nonce: '0x7',
          }),
          address: account.address,
          updateNonce: false,
        }),
      );
      expect(formatAbi).toHaveBeenCalledWith({ func: 'transfer' });
    });

    it('uses testOpenapi when parsing testnet contract calls', async () => {
      getRecommendNonce.mockResolvedValue('0x8');
      testnetPreExecTx.mockResolvedValue({
        abi: {
          func: 'approve',
        },
      });

      const { result } = renderHook(() =>
        useParseContractAddress(
          {
            contractAddress: '0x4444444444444444444444444444444444444444',
            userAddress: account.address,
            chain: { ...chain, id: 5, network: '5' } as never,
            inputDataHex: '0x095ea7b3',
            account,
          },
          { isTestnet: true },
        ),
      );

      await waitFor(() => {
        expect(result.current.contractCallPlainText).toBe(
          'transfer(address,uint256)',
        );
      });
      expect(testnetPreExecTx).toHaveBeenCalled();
      expect(preExecTx).not.toHaveBeenCalled();
    });
  });
});
