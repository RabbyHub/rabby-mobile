import { requestReadOnlyETHRpc } from '@/core/apis/readOnlyRpc';
import type { Account } from '@/types/account';

export const HYPER_EVM_SMALL_BLOCK_GAS_LIMIT = 3_000_000;
export const HYPER_EVM_BIG_BLOCK_GAS_LIMIT = 30_000_000;

export const isHyperEvmChain = (chainId: number | string) =>
  Number(chainId) === 999;

export async function getHyperEvmGasLimit({
  chain,
  from,
  account,
}: {
  chain: { id: number; serverId: string };
  from: string;
  account: Account;
}): Promise<number | null> {
  if (!isHyperEvmChain(chain.id)) return null;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const usingBigBlocks = await Promise.race([
      requestReadOnlyETHRpc<boolean>(
        { method: 'eth_usingBigBlocks', params: [from] },
        chain.serverId,
        account,
      ),
      new Promise<null>(resolve => {
        timeout = setTimeout(() => resolve(null), 5000);
      }),
    ]);
    if (usingBigBlocks === true) return HYPER_EVM_BIG_BLOCK_GAS_LIMIT;
    if (usingBigBlocks === false) return HYPER_EVM_SMALL_BLOCK_GAS_LIMIT;
  } catch (error) {
    // An unsupported or failed mode query is not evidence of small-block mode.
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
  return null;
}
