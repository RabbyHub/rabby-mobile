import axios from 'axios';
import { BigNumber, providers, utils } from 'ethers';
import { Pool } from '@aave/contract-helpers';
import type { StorageAdapater } from '@rabby-wallet/persist-store';
import { CHAINS_ENUM } from '@/constant/chains';
import { openapi } from '@/core/request';
// Integration coverage constructs the real RPC service instead of mocking it.
// eslint-disable-next-line no-runtime-service-imports
import { CustomRPCService } from '@/core/services/customRPCService';
import { buildWithdrawTx } from './poolService';

const USER = '0x1111111111111111111111111111111111111111';
const POOL = '0x2222222222222222222222222222222222222222';
const TOKEN = '0x3333333333333333333333333333333333333333';
const ATOKEN = '0x4444444444444444444444444444444444444444';
const ATTACKER = '0x6666666666666666666666666666666666666666';
const remoteTransaction = {
  from: USER,
  to: ATTACKER,
  data: '0x',
  value: '0x1',
};

function buildWithdrawal(pool: Pool) {
  return buildWithdrawTx({
    pool,
    address: USER,
    reserve: TOKEN,
    aTokenAddress: ATOKEN,
    amount: '1',
  });
}

describe('Lending withdraw RPC error integration', () => {
  let pool: Pool;
  let provider: providers.Web3Provider;
  let estimateError: Record<string, unknown> | undefined;

  beforeEach(() => {
    estimateError = undefined;
    jest.mocked(axios.get).mockResolvedValue({ data: { rpcs: [] } });
    jest.mocked(openapi.request.get).mockResolvedValue({ data: { rpcs: [] } });
    const values = new Map<string, unknown>();
    const storageAdapter: StorageAdapater = {
      getItem: key => values.get(String(key)) ?? null,
      setItem: (key, value) => {
        values.set(String(key), value);
      },
      removeItem: key => {
        values.delete(String(key));
      },
      clearAll: () => values.clear(),
    };
    const service = new CustomRPCService({ storageAdapter });
    service.setRPC(CHAINS_ENUM.ETH, 'https://rpc.example');
    // Only HTTP is replaced; the RPC service, Ethers and Aave builders are real.
    jest.mocked(axios.post).mockImplementation(async (_url, body) => {
      const { method, params } = body as {
        method: string;
        params: Array<{ data: string }>;
      };
      if (method === 'eth_chainId') return { data: { result: '0x1' } };
      if (method === 'eth_estimateGas') {
        return {
          data: estimateError
            ? { error: estimateError }
            : { result: '0x7a120' },
        };
      }
      if (method === 'eth_call') {
        const selector = params[0].data.slice(0, 10);
        if (selector !== '0x313ce567') {
          throw new Error(`Unexpected offline eth_call: ${selector}`);
        }
        return {
          data: {
            result: utils.defaultAbiCoder.encode(['uint256'], [18]),
          },
        };
      }
      throw new Error(`Unexpected offline RPC method: ${method}`);
    });
    provider = new providers.Web3Provider(
      {
        request: ({ method, params }) =>
          service.requestCustomRPC(CHAINS_ENUM.ETH, method, params || []),
      },
      { name: 'homestead', chainId: 1 },
    );
    pool = new Pool(provider, { POOL });
  });

  afterEach(() => {
    provider.removeAllListeners();
    jest.mocked(axios.post).mockReset();
  });

  it('rejects a neutral RPC error carrying a replacement transaction', async () => {
    estimateError = {
      code: -32000,
      message: 'backend unavailable',
      transaction: remoteTransaction,
    };
    const pending = buildWithdrawal(pool);
    await expect(pending).rejects.toMatchObject({
      message: 'backend unavailable',
    });
    await expect(pending).rejects.not.toHaveProperty('transaction');
  });

  it('keeps the original locally built transaction for ordinary estimation-error fallback', async () => {
    const original = await buildWithdrawal(pool);
    expect(original.to).toBe(POOL);
    estimateError = {
      code: -32000,
      message: 'execution reverted',
      transaction: remoteTransaction,
      data: { transaction: remoteTransaction },
    };
    const fallback = await buildWithdrawal(pool);
    expect(fallback).toMatchObject({
      to: original.to,
      from: original.from,
      data: original.data,
    });
    expect(BigNumber.from(fallback.value).eq(original.value || 0)).toBe(true);
  });
});
