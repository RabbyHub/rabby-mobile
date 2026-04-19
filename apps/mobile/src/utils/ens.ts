import { requestETHRpc } from '@/core/apis/provider';
import { findChain } from '@/utils/chain';
import { createPublicClient, custom } from 'viem';
import { mainnet } from 'viem/chains';
import { normalize } from 'viem/ens';

const ethServerId = findChain({ id: 1 })?.serverId || 'eth';

const ensClient = createPublicClient({
  chain: mainnet,
  transport: custom({
    request: ({ method, params }) =>
      requestETHRpc(
        {
          method,
          params: (params || []) as any[],
        },
        ethServerId,
      ),
  }),
});

export const resolveEnsAddressByName = async (
  name: string,
): Promise<{ addr: string; name: string } | null> => {
  const input = name?.trim();
  if (!input) {
    return null;
  }

  try {
    const normalizedName = normalize(input);
    const addr = await ensClient.getEnsAddress({
      name: normalizedName,
    });
    if (!addr) {
      return null;
    }
    return {
      addr,
      name: normalizedName,
    };
  } catch {
    return null;
  }
};

export const resolveEnsNameByAddress = async (
  address: string,
): Promise<string | null> => {
  const input = address?.trim();
  if (!input) {
    return null;
  }

  try {
    const name = await ensClient.getEnsName({
      address: input as `0x${string}`,
    });
    if (!name) {
      return null;
    }
    return name;
  } catch {
    return null;
  }
};
