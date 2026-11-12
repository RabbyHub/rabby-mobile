import axios from 'axios';
import { makeMemoryStorage } from '@rabby-wallet/persist-store/dist/storageAdapter';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils/dist/types';
import { CustomRPCService } from '@/core/services/customRPCService';
import {
  getRegisteredService,
  registerService,
} from '@/core/services/serviceRegistry';
import { findChain } from '@/utils/chain';
import { getHyperEvmGasLimit } from '@/utils/hyperEvm';

class TestCustomRPCService extends CustomRPCService {
  setDefaultRPCForTest(chainServerId: string, rpcUrl: string) {
    this.mutateStore(draft => {
      draft.defaultRPC = {
        [chainServerId]: {
          chainId: chainServerId,
          rpcUrl: [rpcUrl],
          txPushToRPC: true,
        },
      };
    });
  }
}

describe('HyperEVM internal sender-mode RPC integration', () => {
  it('queries the default RPC without a connected dapp and uses the transaction sender', async () => {
    const rpcUrl = 'https://hyper-rpc.example';
    const chain = findChain({ id: 999 })!;
    const account = {
      address: '0x1111111111111111111111111111111111111111',
      type: KEYRING_TYPE.SimpleKeyring,
      brandName: KEYRING_TYPE.SimpleKeyring,
    };
    const from = '0x2222222222222222222222222222222222222222';
    jest.mocked(axios.get).mockResolvedValue({ data: { rpcs: [] } });
    jest.mocked(axios.post).mockResolvedValue({ data: { result: true } });
    const service = new TestCustomRPCService({
      storageAdapter: makeMemoryStorage(),
    });
    service.setDefaultRPCForTest(chain.serverId, rpcUrl);
    const unregister = registerService('customRPCService', service);

    try {
      expect(getRegisteredService('dappService')).toBeUndefined();
      await expect(getHyperEvmGasLimit({ chain, from, account })).resolves.toBe(
        30_000_000,
      );
      expect(axios.post).toHaveBeenCalledWith(
        rpcUrl,
        {
          jsonrpc: '2.0',
          id: expect.any(Number),
          method: 'eth_usingBigBlocks',
          params: [from],
        },
        { timeout: 5000 },
      );
    } finally {
      unregister();
      jest.clearAllMocks();
    }
  });
});
