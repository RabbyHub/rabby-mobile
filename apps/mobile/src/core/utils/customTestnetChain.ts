import { CHAINS_ENUM } from '@debank/common';
import { intToHex } from 'ethereumjs-util';
import type {
  CustomTestnetEip1559Detection,
  TestnetChain,
  TestnetChainBase,
} from '@/types/customTestnet';

export const createTestnetChain = (
  chain: TestnetChainBase,
  options?: {
    supportsEip1559?: boolean;
  },
): TestnetChain => {
  return {
    ...chain,
    id: +chain.id,
    hex: intToHex(+chain.id),
    network: `${chain.id}`,
    enum: `CUSTOM_${chain.id}` as CHAINS_ENUM,
    serverId: `custom_${chain.id}`,
    nativeTokenAddress: `custom_${chain.id}`,
    nativeTokenDecimals: 18,
    nativeTokenLogo: '',
    scanLink: chain.scanLink || '',
    logo: `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><circle cx='16' cy='16' r='16' fill='%236A7587'></circle><text x='16' y='17' dominant-baseline='middle' text-anchor='middle' fill='white' font-size='12' font-weight='400'>${encodeURIComponent(
      chain.name.substring(0, 3),
    )}</text></svg>`,
    eip: {
      // unknown or failed detection keeps the chain on legacy transactions
      1559: !!options?.supportsEip1559,
    },
    isTestnet: true,
    severity: 0,
  };
};

/**
 * Chain list for custom networks, with EIP-1559 support taken from the
 * detection results instead of the user-entered config.
 */
export const createTestnetChainList = (
  customTestnet: Record<string, TestnetChainBase>,
  eip1559?: Record<string, CustomTestnetEip1559Detection> | null,
): TestnetChain[] => {
  return Object.values(customTestnet).map(item =>
    createTestnetChain(item, {
      supportsEip1559: !!eip1559?.[item.id]?.supported,
    }),
  );
};
