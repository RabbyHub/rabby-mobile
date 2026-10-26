import { getRecommendGas } from '@/components/Approval/components/SignTx/getRecommendGas';
import type { Tx } from '@rabby-wallet/rabby-api/dist/types';

import { resolveNativeTransferGasLimit } from './nativeTransferGas';

describe('Send native transfer gas integration', () => {
  it('passes pre-exec gas to MiniSign with the safety ratio enabled', async () => {
    const tx = {
      chainId: 1,
      from: '0x0000000000000000000000000000000000000001',
      to: '0x0000000000000000000000000000000000000002',
      value: '0x0',
      data: '0x',
    } as Tx;

    const presetGas = resolveNativeTransferGasLimit({
      estimatedGas: 0,
      needEstimateGas: true,
      couldSpecifyIntrinsicGas: true,
      isContract: false,
    });
    expect(presetGas).toBeUndefined();

    const recommended = await getRecommendGas({
      gas: 21000,
      gasUsed: 21000,
      tx,
      chainId: tx.chainId,
    });

    expect(recommended.needRatio).toBe(true);
    expect(recommended.gas.toFixed(0)).toBe('21000');
  });
});
